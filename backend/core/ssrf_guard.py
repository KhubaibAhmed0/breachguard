import socket
import ipaddress
import urllib.parse
import httpx
import httpcore
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "instance-data",
    "169.254.169.254",
}

BLOCKED_IP_NETWORKS = [
    # IPv4 Special & Private Ranges
    ipaddress.ip_network("0.0.0.0/8"),         # Current network (only valid as source)
    ipaddress.ip_network("10.0.0.0/8"),        # Private RFC 1918
    ipaddress.ip_network("100.64.0.0/10"),     # Shared Address Space / CGNAT RFC 6598
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback RFC 1122
    ipaddress.ip_network("169.254.0.0/16"),    # Link-Local / Cloud Metadata RFC 3927
    ipaddress.ip_network("172.16.0.0/12"),     # Private RFC 1918
    ipaddress.ip_network("192.0.0.0/24"),      # IETF Protocol Assignments RFC 6890
    ipaddress.ip_network("192.0.2.0/24"),      # TEST-NET-1 RFC 5737
    ipaddress.ip_network("192.88.99.0/24"),    # 6to4 Relay Anycast RFC 7526
    ipaddress.ip_network("192.168.0.0/16"),    # Private RFC 1918
    ipaddress.ip_network("198.18.0.0/15"),     # Benchmarking RFC 2544
    ipaddress.ip_network("198.51.100.0/24"),   # TEST-NET-2 RFC 5737
    ipaddress.ip_network("203.0.113.0/24"),    # TEST-NET-3 RFC 5737
    ipaddress.ip_network("224.0.0.0/4"),       # Multicast RFC 5771
    ipaddress.ip_network("240.0.0.0/4"),       # Reserved for Future Use RFC 1112
    ipaddress.ip_network("255.255.255.255/32"),# Limited Broadcast

    # IPv6 Special & Private Ranges
    ipaddress.ip_network("::1/128"),           # Loopback
    ipaddress.ip_network("::/128"),            # Unspecified
    ipaddress.ip_network("::ffff:0:0/96"),     # IPv4-mapped IPv6
    ipaddress.ip_network("64:ff9b::/96"),      # IPv4/IPv6 translation
    ipaddress.ip_network("100::/64"),          # Discard prefix
    ipaddress.ip_network("2001:db8::/32"),     # Documentation
    ipaddress.ip_network("fc00::/7"),          # Unique Local Address (ULA)
    ipaddress.ip_network("fe80::/10"),         # Link-Local
    ipaddress.ip_network("ff00::/8"),          # Multicast
]

def is_ip_blocked(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    # Extract mapped IPv4 if using IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1)
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped:
        ip = mapped

    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return True

    for net in BLOCKED_IP_NETWORKS:
        if ip in net:
            return True
    return False

def validate_url_for_ssrf(url_str: str, resolve_dns: bool = True) -> str:
    """
    Validates that a URL does not target localhost, private ranges, link-local,
    cloud metadata endpoints, or internal domains. Raises HTTPException(400) if blocked.
    """
    if not url_str or not isinstance(url_str, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL format."
        )

    parsed = urllib.parse.urlsplit(url_str.strip())
    
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

    if clean_host in BLOCKED_HOSTS or any(clean_host.endswith(suffix) for suffix in (".internal", ".local", ".localhost", ".arpa", ".invalid")):
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
                        detail="Resolved host IP is in a restricted network range."
                    )
        except socket.gaierror:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to resolve hostname via DNS."
            )

    return url_str.strip()

class PinnedDNSBackend(httpcore.AsyncNetworkBackend):
    """
    Custom Network Backend that pins socket connections to a pre-validated IP address,
    preventing Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks.
    """
    def __init__(self, pinned_host: str, pinned_ip: str):
        self._backend = httpcore.AnyIOBackend()
        self.pinned_host = pinned_host
        self.pinned_ip = pinned_ip

    async def connect_tcp(self, host: str, port: int, timeout: Optional[float] = None, local_address: Optional[str] = None, socket_options: Optional[Any] = None):
        target_host = self.pinned_ip if host == self.pinned_host else host
        return await self._backend.connect_tcp(target_host, port, timeout=timeout, local_address=local_address, socket_options=socket_options)

    async def connect_tls(self, *args, **kwargs):
        return await self._backend.connect_tls(*args, **kwargs)

async def safe_http_post(
    url: str, 
    json_payload: Dict[str, Any], 
    timeout: float = 10.0,
    headers: Optional[Dict[str, str]] = None
) -> httpx.Response:
    """
    Safely executes an outbound HTTP POST request with:
    1. Full SSRF URL and IP validation against private/metadata addresses.
    2. DNS Rebinding defense via IP pinning (connecting directly to the pre-verified IP).
    3. Disabled redirects (follow_redirects=False) to prevent 3xx bounce attacks.
    4. Custom authentication & signature headers support.
    """
    validated_url = validate_url_for_ssrf(url, resolve_dns=False)
    parsed = urllib.parse.urlsplit(validated_url)
    clean_host = parsed.hostname.strip().lower()
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    # Resolve all DNS addresses
    try:
        addr_info = socket.getaddrinfo(clean_host, port, family=socket.AF_UNSPEC, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to resolve destination hostname via DNS."
        )

    if not addr_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No IP addresses resolved for hostname."
        )

    # Verify that EVERY returned IP address is safe
    for entry in addr_info:
        ip_addr = entry[4][0]
        if is_ip_blocked(ip_addr):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resolved host IP targets a restricted network address."
            )

    chosen_ip = addr_info[0][4][0]

    # Initialize pinned transport to guarantee connection connects only to verified IP
    transport = httpx.AsyncHTTPTransport()
    transport._pool = httpcore.AsyncConnectionPool(
        network_backend=PinnedDNSBackend(clean_host, chosen_ip)
    )

    # Dispatch request with follow_redirects=False (Strict redirect boundary)
    async with httpx.AsyncClient(transport=transport, timeout=timeout, follow_redirects=False) as client:
        response = await client.post(validated_url, json=json_payload, headers=headers)
        return response

