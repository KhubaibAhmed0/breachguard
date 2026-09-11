import logging
import asyncio
import socket
import json
import httpx
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

_SUBDOMAIN_CACHE: Dict[str, Tuple[float, List[str]]] = {}
_SHODAN_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

ADMIN_PORTS = {
    22: ('SSH', 'Secure Shell administrative remote access service', 'high'),
    3389: ('RDP', 'Microsoft Remote Desktop administrative service', 'high'),
    23: ('Telnet', 'Unencrypted legacy remote administration protocol', 'critical'),
    21: ('FTP', 'File Transfer Protocol service', 'medium'),
    3306: ('MySQL', 'Relational database service listening on public interface', 'high'),
    5432: ('PostgreSQL', 'PostgreSQL database service listening on public interface', 'high'),
    27017: ('MongoDB', 'MongoDB NoSQL database interface exposed to internet', 'high'),
    6379: ('Redis', 'In-memory Redis datastore exposed to internet', 'critical'),
    5900: ('VNC', 'Virtual Network Computing remote desktop access', 'high'),
    8080: ('HTTP-Proxy / Alt-HTTP', 'Alternative web service or administrative interface', 'low'),
    8443: ('HTTPS-Alt', 'Alternative TLS management console or web interface', 'low'),
}

async def discover_subdomains(domain: str, timeout: float = 5.0) -> List[str]:
    """
    Queries Certificate Transparency logs via crt.sh to discover subdomains.
    Sanitizes, normalizes, and deduplicates all returned records.
    Cached for 15 minutes in memory.
    """
    clean_domain = domain.lower().strip().lstrip('.').split(':')[0]
    now = time.time()
    if clean_domain in _SUBDOMAIN_CACHE:
        cached_time, cached_subs = _SUBDOMAIN_CACHE[clean_domain]
        if now - cached_time < 900.0:
            return list(cached_subs)

    discovered = set()
    discovered.add(clean_domain)
    
    url = f"https://crt.sh/?q=%.{clean_domain}&output=json"
    headers = {"User-Agent": "BreachGuard-Security-Auditor/2.0"}
    
    try:
        # BG-SEC-07: Standard TLS verification enforced (verify=True)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                for entry in data:
                    name_value = entry.get("name_value", "")
                    for sub in name_value.split("\n"):
                        sub = sub.strip().lower()
                        if sub.startswith("*."):
                            sub = sub[2:]
                        if sub.endswith(clean_domain) and len(sub) <= 100:
                            if all(c.isalnum() or c in ".-" for c in sub):
                                discovered.add(sub)
    except Exception as e:
        logger.warning(f"crt.sh discovery encountered fallback or timeout for {clean_domain}: {e}")
        # Standard corporate hostnames fallback if external CT logs are slow
        for prefix in ["mail", "vpn", "remote", "portal", "dev", "api"]:
            discovered.add(f"{prefix}.{clean_domain}")

    result_subs = sorted(list(discovered))
    _SUBDOMAIN_CACHE[clean_domain] = (now, result_subs)
    return result_subs

async def resolve_hostname(hostname: str) -> Optional[str]:
    """
    Asynchronously resolves a hostname to an IPv4 address.
    """
    loop = asyncio.get_running_loop()
    try:
        addrinfo = await loop.getaddrinfo(hostname, None, family=socket.AF_INET, type=socket.SOCK_STREAM)
        if addrinfo and len(addrinfo) > 0:
            return addrinfo[0][4][0]
    except Exception:
        pass
    return None

async def query_shodan_internetdb(ip: str, timeout: float = 3.0) -> Dict[str, Any]:
    """
    Queries Shodan InternetDB for passive open ports, hostnames, CPEs, and known CVEs.
    Free, non-intrusive, zero API key required. Cached for 1 hour.
    """
    now = time.time()
    if ip in _SHODAN_CACHE:
        cached_time, cached_data = _SHODAN_CACHE[ip]
        if now - cached_time < 3600.0:
            return cached_data

    url = f"https://internetdb.shodan.io/{ip}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                _SHODAN_CACHE[ip] = (now, data)
                return data
    except Exception as e:
        logger.debug(f"Shodan InternetDB lookup skipped or timed out for {ip}: {e}")
    return {}

async def analyze_attack_surface(domain: str) -> Dict[str, Any]:
    """
    Orchestrates external attack surface reconnaissance:
    1. Subdomain discovery via Certificate Transparency
    2. Hostname resolution to IP addresses
    3. Passive enrichment via Shodan InternetDB (parallelized)
    4. Meaningful security finding generation
    """
    subdomains = await discover_subdomains(domain)
    target_hosts = subdomains[:25]
    
    assets = []
    findings = []
    finding_counter = 1

    # 1. Resolve hostnames concurrently
    resolution_tasks = [resolve_hostname(h) for h in target_hosts]
    resolved_ips = await asyncio.gather(*resolution_tasks)

    # 2. Enrich distinct unique IPs concurrently
    distinct_ips = list(set(ip for ip in resolved_ips if ip))
    ip_enrichment_tasks = [query_shodan_internetdb(ip) for ip in distinct_ips]
    ip_enrichment_results = await asyncio.gather(*ip_enrichment_tasks)
    unique_ips = dict(zip(distinct_ips, ip_enrichment_results))

    for host, ip in zip(target_hosts, resolved_ips):
        asset_info = {
            "hostname": host,
            "ip_address": ip,
            "open_ports": [],
            "services": {},
            "vulns": [],
            "cpes": [],
            "source": "crt.sh"
        }
        
        # Check for publicly reachable development / staging environment
        is_dev_host = any(host.startswith(p) for p in ["dev.", "staging.", "test.", "stage.", "qa.", "uat."])
        if is_dev_host and ip:
            findings.append({
                "finding_id": f"BG-EXT-{finding_counter:03d}",
                "category": "attack_surface",
                "title": "Publicly Observable Development / Staging Hostname",
                "severity": "low",
                "status": "open",
                "observed_status": "detected",
                "confidence": "high",
                "asset": host,
                "evidence": f'Hostname "{host}" resolved to public IP {ip}.',
                "sources": json.dumps(["crt.sh", "DNS Resolution"]),
                "description": f"A development or pre-production hostname ({host}) is publicly resolvable in external DNS/certificates.",
                "security_impact": "Exposed pre-production environments may contain debugging features, test accounts, or less strict authentication than production.",
                "recommended_remediation": "Place development and testing interfaces behind an authenticated corporate VPN or IP allowlist.",
                "references": "CIS Control 4: Secure Configuration of Enterprise Assets; OWASP Top 10: Security Misconfiguration"
            })
            finding_counter += 1

        if ip and ip in unique_ips:
            enrichment = unique_ips[ip]
            if enrichment:
                asset_info["open_ports"] = enrichment.get("ports", [])
                asset_info["vulns"] = enrichment.get("vulns", [])
                asset_info["cpes"] = enrichment.get("cpes", [])
                asset_info["source"] = "crt.sh / Shodan InternetDB"

                # Analyze open ports for sensitive services
                for port in asset_info["open_ports"]:
                    if port in ADMIN_PORTS:
                        svc_name, svc_desc, svc_sev = ADMIN_PORTS[port]
                        asset_info["services"][str(port)] = svc_name
                        findings.append({
                            "finding_id": f"BG-EXT-{finding_counter:03d}",
                            "category": "attack_surface",
                            "title": f"Exposed Administrative Service ({svc_name} on Port {port})",
                            "severity": svc_sev,
                            "status": "open",
                            "observed_status": "detected",
                            "confidence": "high",
                            "asset": f"{host}:{port}",
                            "evidence": f"Port {port} ({svc_name}) observed active on resolved IP {ip}. {svc_desc}.",
                            "sources": json.dumps(["Shodan InternetDB", "Passive Telemetry"]),
                            "description": f"An administrative service ({svc_name}) is externally reachable on port {port}.",
                            "security_impact": "Directly exposed administrative ports increase external attack surface and may be subjected to brute-force or credential stuffing.",
                            "recommended_remediation": f"Restrict port {port} using corporate firewall rules, IP allowlisting, or an authenticated VPN gateway.",
                            "references": "NIST CSF: PR.AC-1; CIS Control 4.1; OWASP A05:2021 Security Misconfiguration"
                        })
                        finding_counter += 1

                # Check for known vulnerability indicators
                if asset_info["vulns"]:
                    cve_list = asset_info["vulns"][:5]
                    findings.append({
                        "finding_id": f"BG-EXT-{finding_counter:03d}",
                        "category": "attack_surface",
                        "title": "Known Vulnerability Indicators Observed on Associated Host",
                        "severity": "medium",
                        "status": "open",
                        "observed_status": "detected",
                        "confidence": "medium",
                        "asset": f"{host} ({ip})",
                        "evidence": f'Public threat intelligence feeds report vulnerability indicators ({", ".join(cve_list)}) associated with host IP {ip}.',
                        "sources": json.dumps(["Shodan InternetDB"]),
                        "description": "One or more public vulnerability identifiers are indexed against the host IP address in public security intelligence databases.",
                        "security_impact": "Associated software services may contain known software vulnerabilities if patches have not been applied.",
                        "recommended_remediation": "Audit listening services on the server, verify installed software package versions, and apply vendor security patches.",
                        "references": "NIST CSF: ID.RA-1; CIS Control 7: Continuous Vulnerability Management"
                    })
                    finding_counter += 1

        assets.append(asset_info)

    return {
        "domain": domain,
        "discovered_subdomains_count": len(subdomains),
        "subdomains": subdomains,
        "assets": assets,
        "findings": findings
    }
