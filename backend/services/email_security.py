import logging
import dns.resolver
import dns.dnssec
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

COMMON_DKIM_SELECTORS = ["google", "k1", "default", "s1", "selector1", "mail", "dkim", "smtp", "2023", "2024"]

def query_dns_txt(name: str, timeout: float = 3.0) -> List[str]:
    """Queries DNS TXT records with a short timeout."""
    records = []
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = timeout
        resolver.lifetime = timeout
        answers = resolver.resolve(name, "TXT")
        for rdata in answers:
            txt_content = b"".join(rdata.strings).decode("utf-8", errors="replace")
            records.append(txt_content)
    except Exception:
        pass
    return records

def query_dns_mx(domain: str, timeout: float = 3.0) -> List[Dict[str, Any]]:
    """Queries MX records for the domain."""
    mx_records = []
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = timeout
        resolver.lifetime = timeout
        answers = resolver.resolve(domain, "MX")
        for rdata in answers:
            mx_records.append({
                "preference": rdata.preference,
                "exchange": str(rdata.exchange).rstrip(".")
            })
    except Exception:
        pass
    return sorted(mx_records, key=lambda x: x["preference"])

def check_dnssec(domain: str, timeout: float = 3.0) -> bool:
    """Checks if DNSSEC DNSKEY or DS records are published."""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = timeout
        resolver.lifetime = timeout
        resolver.resolve(domain, "DNSKEY")
        return True
    except Exception:
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = timeout
            resolver.lifetime = timeout
            resolver.resolve(domain, "DS")
            return True
        except Exception:
            return False

async def analyze_email_security(domain: str) -> Dict[str, Any]:
    """
    Evaluates complete email security posture:
    1. SPF presence, mechanisms, and syntax
    2. DMARC policy enforcement (p=reject, p=quarantine, p=none)
    3. DKIM public selector verification
    4. MX record presence and mail hosts
    5. MTA-STS and TLS Reporting (TLS-RPT)
    6. DNSSEC support
    7. Calculates 0-100 Email Security Score and structured findings
    """
    clean_domain = domain.lower().strip().lstrip(".").split(":")[0]
    findings = []
    finding_counter = 1
    score = 0

    # 1. SPF Analysis
    spf_records = [r for r in query_dns_txt(clean_domain) if r.startswith("v=spf1")]
    spf_status = "fail"
    spf_record = None
    spf_details = "An SPF record was not detected for the monitored domain."

    if spf_records:
        spf_record = spf_records[0]
        if "+all" in spf_record:
            spf_status = "warning"
            spf_details = "SPF record is overly permissive (+all allows any host to send on behalf of the domain)."
            score += 5
            findings.append({
                "finding_id": f"BG-EML-{finding_counter:03d}",
                "category": "email_security",
                "title": "Overly Permissive SPF Record (+all)",
                "severity": "high",
                "status": "open",
                "observed_status": "detected",
                "confidence": "high",
                "asset": clean_domain,
                "evidence": f'SPF record "{spf_record}" contains +all qualifier.',
                "sources": json.dumps(["DNS TXT Record"]),
                "description": "The published SPF record includes the +all mechanism, which explicitly permits any IP address on the internet to send mail purporting to come from this domain.",
                "security_impact": "Threat actors can easily impersonate the domain in business email compromise (BEC) and phishing attacks without triggering SPF failure.",
                "recommended_remediation": 'Update the SPF mechanism from "+all" to softfail "~all" or strict hardfail "-all" while listing legitimate outbound mail relays.',
                "references": "RFC 7208; NIST SP 800-177 Trustworthy Email; CIS Control 9.5"
            })
            finding_counter += 1
        elif "~all" in spf_record or "-all" in spf_record:
            spf_status = "pass"
            spf_details = f"Valid SPF record active ({spf_record})."
            score += 25
        else:
            spf_status = "warning"
            spf_details = f"SPF record published but lacks explicit all qualifier ({spf_record})."
            score += 15
    else:
        findings.append({
            "finding_id": f"BG-EML-{finding_counter:03d}",
            "category": "email_security",
            "title": "SPF Record Missing",
            "severity": "medium",
            "status": "open",
            "observed_status": "detected",
            "confidence": "high",
            "asset": clean_domain,
            "evidence": f"No TXT record beginning with v=spf1 detected on {clean_domain}.",
            "sources": json.dumps(["DNS TXT Record"]),
            "description": "An SPF (Sender Policy Framework) record was not detected for the monitored domain.",
            "security_impact": "Receiving mail transfer agents cannot verify whether sending servers are authorized by the domain owner, increasing exposure to email spoofing.",
            "recommended_remediation": 'Publish an SPF TXT record on the root domain defining authorized mail exchangers (e.g. "v=spf1 include:_spf.example.com ~all").',
            "references": "RFC 7208; NIST SP 800-177; CIS Control 9.5"
        })
        finding_counter += 1

    # 2. DMARC Analysis
    dmarc_records = [r for r in query_dns_txt(f"_dmarc.{clean_domain}") if r.startswith("v=DMARC1")]
    dmarc_status = "fail"
    dmarc_record = None
    dmarc_policy = "missing"
    dmarc_details = "A DMARC policy record was not detected at _dmarc." + clean_domain

    if dmarc_records:
        dmarc_record = dmarc_records[0]
        # Extract policy p=
        tags = {part.split("=")[0].strip().lower(): part.split("=")[1].strip().lower() 
                for part in dmarc_record.split(";") if "=" in part}
        dmarc_policy = tags.get("p", "none")

        if dmarc_policy == "reject":
            dmarc_status = "pass"
            dmarc_details = f'Strong DMARC policy enforced (p=reject, rua={tags.get("rua", "none")}).'
            score += 35
        elif dmarc_policy == "quarantine":
            dmarc_status = "pass"
            dmarc_details = f'DMARC policy active with quarantine enforcement (p=quarantine, rua={tags.get("rua", "none")}).'
            score += 30
        elif dmarc_policy == "none":
            dmarc_status = "warning"
            dmarc_details = 'DMARC is deployed in monitoring mode (p=none) without active blocking or quarantine enforcement.'
            score += 15
            findings.append({
                "finding_id": f"BG-EML-{finding_counter:03d}",
                "category": "email_security",
                "title": "DMARC Policy Not Enforced (p=none)",
                "severity": "medium",
                "status": "open",
                "observed_status": "detected",
                "confidence": "high",
                "asset": f"_dmarc.{clean_domain}",
                "evidence": f'DMARC record "{dmarc_record}" uses policy p=none.',
                "sources": json.dumps(["DNS TXT Record"]),
                "description": "A DMARC policy is published but set to monitoring mode (p=none). While reporting is active, fraudulent messages failing authentication are still delivered to recipient inboxes.",
                "security_impact": "Threat actors can spoof the corporate domain without messages being blocked or relegated to spam folders by receiving mail servers.",
                "recommended_remediation": 'Review aggregate DMARC feedback reports (rua), ensure all authorized outbound senders align SPF/DKIM, and advance policy to "p=quarantine" and ultimately "p=reject".',
                "references": "RFC 7489; NIST SP 800-177; CISA Binding Operational Directive 18-01"
            })
            finding_counter += 1
    else:
        findings.append({
            "finding_id": f"BG-EML-{finding_counter:03d}",
            "category": "email_security",
            "title": "DMARC Record Missing",
            "severity": "high",
            "status": "open",
            "observed_status": "detected",
            "confidence": "high",
            "asset": f"_dmarc.{clean_domain}",
            "evidence": f"No DMARC TXT record detected at _dmarc.{clean_domain}.",
            "sources": json.dumps(["DNS TXT Record"]),
            "description": "The domain lacks a DMARC (Domain-based Message Authentication, Reporting, and Conformance) record.",
            "security_impact": "Without DMARC, receiving email providers have no instruction on how to handle spoofed messages claiming to originate from your organization.",
            "recommended_remediation": 'Publish a DMARC record at _dmarc.{clean_domain} (initially "v=DMARC1; p=none; rua=mailto:dmarc-reports@{clean_domain}") to monitor traffic, then graduate to p=quarantine / p=reject.',
            "references": "RFC 7489; NIST SP 800-177; CISA BOD 18-01; CIS Control 9.5"
        })
        finding_counter += 1

    # 3. DKIM Selector Verification
    dkim_status = "not_verifiable"
    dkim_details = "DKIM could not be verified from publicly discoverable selectors."
    found_selector = None

    for sel in COMMON_DKIM_SELECTORS:
        txts = query_dns_txt(f"{sel}._domainkey.{clean_domain}")
        for t in txts:
            if "v=DKIM1" in t or "p=" in t:
                found_selector = sel
                break
        if found_selector:
            break

    if found_selector:
        dkim_status = "pass"
        dkim_details = f'Public DKIM key discovered using selector "{found_selector}".'
        score += 10
    else:
        # Standard neutral score credit for unobservable custom selectors
        score += 7

    # 4. MX Record Analysis
    mx_list = query_dns_mx(clean_domain)
    mx_status = "pass" if mx_list else "fail"
    if mx_list:
        score += 15
    else:
        findings.append({
            "finding_id": f"BG-EML-{finding_counter:03d}",
            "category": "email_security",
            "title": "No MX Records Detected",
            "severity": "low",
            "status": "open",
            "observed_status": "detected",
            "confidence": "high",
            "asset": clean_domain,
            "evidence": f"No MX records returned for {clean_domain}.",
            "sources": json.dumps(["DNS MX Lookup"]),
            "description": "No Mail Exchange (MX) records are published for this domain.",
            "security_impact": "If this domain is intended to receive email, inbound messages will fail delivery.",
            "recommended_remediation": "Configure primary and secondary MX records pointing to designated enterprise mail providers.",
            "references": "RFC 5321 Simple Mail Transfer Protocol"
        })
        finding_counter += 1

    # 5. MTA-STS & TLS-RPT
    mta_sts_records = query_dns_txt(f"_mta-sts.{clean_domain}")
    mta_sts_status = "pass" if any("v=STSv1" in r for r in mta_sts_records) else "not_detected"
    if mta_sts_status == "pass":
        score += 5

    tls_rpt_records = query_dns_txt(f"_smtp._tls.{clean_domain}")
    tls_rpt_status = "pass" if any("v=TLSRPTv1" in r for r in tls_rpt_records) else "not_detected"
    if tls_rpt_status == "pass":
        score += 5

    # 6. DNSSEC
    dnssec_active = check_dnssec(clean_domain)
    dnssec_status = "pass" if dnssec_active else "not_detected"
    if dnssec_active:
        score += 5

    # Clamp score to 0-100
    score = max(0, min(100, score))

    return {
        "domain": clean_domain,
        "score": score,
        "spf": {
            "status": spf_status,
            "record": spf_record,
            "details": spf_details
        },
        "dmarc": {
            "status": dmarc_status,
            "record": dmarc_record,
            "policy": dmarc_policy,
            "details": dmarc_details
        },
        "dkim": {
            "status": dkim_status,
            "details": dkim_details
        },
        "mx": {
            "status": mx_status,
            "records": mx_list
        },
        "mta_sts": {
            "status": mta_sts_status
        },
        "tls_rpt": {
            "status": tls_rpt_status
        },
        "dnssec": {
            "status": dnssec_status
        },
        "findings": findings
    }
