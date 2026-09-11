import logging
import asyncio
import os
import json
import httpx
import time
from typing import Dict, Any, List, Tuple
from services.hibp_service import check_domain_breaches

logger = logging.getLogger(__name__)

_TI_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

async def query_virustotal_domain(domain: str, timeout: float = 3.5) -> Dict[str, Any]:
    """
    Queries VirusTotal v3 domain report if VIRUSTOTAL_API_KEY is configured.
    """
    api_key = os.environ.get("VIRUSTOTAL_API_KEY")
    if not api_key:
        return {}

    url = f"https://www.virustotal.com/api/v3/domains/{domain}"
    headers = {"x-apikey": api_key}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("attributes", {})
                stats = data.get("last_analysis_stats", {})
                return {
                    "malicious": stats.get("malicious", 0),
                    "suspicious": stats.get("suspicious", 0),
                    "harmless": stats.get("harmless", 0),
                    "undetected": stats.get("undetected", 0),
                    "reputation": data.get("reputation", 0)
                }
    except Exception as e:
        logger.debug(f"VirusTotal domain check skipped: {e}")
    return {}

async def analyze_threat_intelligence(domain: str) -> Dict[str, Any]:
    """
    Aggregates public threat intelligence:
    1. Historical public breach records via HIBP
    2. Threat reputation indicators via VirusTotal (when configured)
    3. Produces findings with strict source provenance and confidence ratings
    Cached in-memory for 15 minutes.
    """
    clean_domain = domain.lower().strip().lstrip(".").split(":")[0]
    now = time.time()
    if clean_domain in _TI_CACHE:
        cached_time, cached_val = _TI_CACHE[clean_domain]
        if now - cached_time < 900.0:
            return cached_val

    findings = []
    finding_counter = 1

    # Run HIBP breach check and VirusTotal domain lookup concurrently
    domain_breaches, vt_data = await asyncio.gather(
        check_domain_breaches(clean_domain),
        query_virustotal_domain(clean_domain)
    )

    # 1. HIBP Public Breach Repository
    for breach in domain_breaches:
        source_name = breach.get("source_name", "Public Breach Database")
        breach_date = breach.get("breach_date", "Historical")
        data_classes = breach.get("data_classes", [])
        pwn_count = breach.get("pwn_count", 0)

        findings.append({
            "finding_id": f"BG-THREAT-{finding_counter:03d}",
            "category": "threat_intel",
            "title": f"Historical Public Breach Record ({source_name})",
            "severity": "medium",
            "status": "open",
            "observed_status": "detected",
            "confidence": "high",
            "asset": clean_domain,
            "evidence": f'Domain observed in public breach index "{source_name}" disclosed on {breach_date}. Exposed data categories: {", ".join(data_classes[:6]) if data_classes else "Email addresses"}.',
            "sources": json.dumps(["Have I Been Pwned", "Public Breach Notification"]),
            "description": f"Records associated with {clean_domain} are cataloged in the historical public breach disclosure for {source_name}.",
            "security_impact": "Corporate email addresses or employee accounts associated with this domain were included in historical third-party data exposures.",
            "recommended_remediation": "Enforce mandatory multi-factor authentication (MFA) across all identity providers (IdPs), verify password managers are used, and check for credential reuse.",
            "references": "NIST CSF: PR.AC-6 Identity and Access Management; CIS Control 6: Access Control Management"
        })
        finding_counter += 1

    # 2. VirusTotal Reputation
    if vt_data and (vt_data.get("malicious", 0) > 0 or vt_data.get("suspicious", 0) > 0):
        mal_count = vt_data.get("malicious", 0)
        susp_count = vt_data.get("suspicious", 0)
        total_flags = mal_count + susp_count
        findings.append({
            "finding_id": f"BG-THREAT-{finding_counter:03d}",
            "category": "threat_intel",
            "title": "Security Vendor Suspicious Reputation Flags",
            "severity": "high" if mal_count >= 3 else "medium",
            "status": "open",
            "observed_status": "detected",
            "confidence": "medium",
            "asset": clean_domain,
            "evidence": f"{total_flags} security vendors currently classify the observed domain indicator as suspicious or malicious ({mal_count} malicious, {susp_count} suspicious).",
            "sources": json.dumps(["VirusTotal Threat Intelligence", "Security Vendor Telemetry"]),
            "description": "Public threat reputation scanners report that independent antivirus and threat intelligence vendors have flagged indicators associated with this domain.",
            "security_impact": "Outbound emails or web links associated with this domain may experience delivery degradation, spam filtering, or security gateway blocking.",
            "recommended_remediation": "Review domain DNS records for unauthorized changes, submit false-positive delisting requests to flagging vendors, and inspect website files for compromised redirection scripts.",
            "references": "NIST CSF: DE.AE-2 Security Event Analysis"
        })
        finding_counter += 1

    res = {
        "domain": clean_domain,
        "breaches_count": len(domain_breaches),
        "breaches": domain_breaches,
        "virustotal": vt_data,
        "findings": findings
    }
    _TI_CACHE[clean_domain] = (now, res)
    return res
