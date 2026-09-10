import socket
import ipaddress
import urllib.parse
from fastapi import HTTPException, status

BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "instance-data",
}

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::1/128"),
]

def is_ip_blocked(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        return True
    for net in BLOCKED_IP_NETWORKS:
        if ip in net:
            return True
    return False

def validate_url_for_ssrf(url_str: str, resolve_dns: bool = True) -> str:
    """
    Validates that a URL does not target localhost, private ranges, link-local,
    or cloud metadata endpoints. Raises HTTPException(400) if blocked.
    """
    if not url_str or not isinstance(url_str, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL format."
        )

    parsed = urllib.parse.urlparse(url_str.strip())
    
    if parsed.scheme.lower() not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only HTTP and HTTPS protocols are permitted."
        )

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is missing a valid hostname."
        )

    clean_host = hostname.strip().lower()

    if clean_host in BLOCKED_HOSTS or clean_host.endswith(".internal") or clean_host.endswith(".local"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requests to internal, loopback, or metadata services are strictly prohibited."
        )

    try:
        if is_ip_blocked(clean_host):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requests to private or link-local IP addresses are strictly prohibited."
            )
    except ValueError:
        pass

    if resolve_dns:
        try:
            addr_info = socket.getaddrinfo(clean_host, None)
            for entry in addr_info:
                resolved_ip = entry[4][0]
                if is_ip_blocked(resolved_ip):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Resolved host IP {resolved_ip} is in a restricted network range."
                    )
        except socket.gaierror:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to resolve hostname via DNS."
            )

    return url_str.strip()
