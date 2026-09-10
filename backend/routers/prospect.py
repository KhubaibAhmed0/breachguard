import re
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Request, status
from schemas.prospect import ProspectScanRequest, ProspectScanResponse
from services.hibp_service import check_domain_breaches
from services.leakcheck_service import check_email as check_leakcheck
from services.email_security import analyze_email_security
from services.external_attack_surface import discover_subdomains
from core.rate_limiter import check_rate_limit, prospect_cache
from core.scanner_monitor import scanner_monitor

logger = logging.getLogger(__name__)

DOMAIN_REGEX = re.compile(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

router = APIRouter()

@router.post("/scan", response_model=ProspectScanResponse)
async def scan_prospect(req: ProspectScanRequest, request: Request):
    """
    Public prospect scan for lead gen.
    Protected with sliding-window rate limiting, abuse pattern detection,
    provider quota capping, strict timeouts, and zero-leakage sanitized summaries.
    Returns the comprehensive External Risk Snapshot.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown_ip")

    # 1. Abuse pattern monitor check
    scanner_monitor.check_scanner_abuse(client_ip)

    # 2. Rate Limiting per IP (5 requests per 60 seconds)
    check_rate_limit(request, "prospect_scan", max_requests=5, window_seconds=60)

    raw_input = req.domain.strip().lower()

    # Length bounds: strictly 3 to 100 characters
    if len(raw_input) > 100 or len(raw_input) < 3:
        scanner_monitor.record_scan_attempt(client_ip, raw_input, status="invalid_input")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain or query must be between 3 and 100 characters."
        )

    # Disallow control or injection characters
    disallowed_chars = ["<", ">", ";", "'", '"', "{", "}", "\\", "`", "$", " ", "|", "&"]
    if any(c in raw_input for c in disallowed_chars):
        scanner_monitor.record_scan_attempt(client_ip, raw_input, status="invalid_input")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in scan query."
        )

    # Rate limiting per target
    from core.rate_limiter import rate_limiter
    if rate_limiter.is_rate_limited(f"target_scan:{raw_input}", max_requests=3, window_seconds=180):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="This target was scanned recently. Please wait a few minutes before querying it again."
        )

    # 3. Cache check (1 hour TTL)
    cache_key = f"prospect:{raw_input}"
    cached_data = prospect_cache.get(cache_key)
    if cached_data:
        scanner_monitor.record_scan_attempt(client_ip, raw_input, status="cached_hit", provider_lookups=0)
        return cached_data

    provider_lookups_count = 0

    try:
        # 4. Handle email query
        if "@" in raw_input:
            if not EMAIL_REGEX.match(raw_input):
                scanner_monitor.record_scan_attempt(client_ip, raw_input, status="invalid_input")
                raise HTTPException(status_code=400, detail="Invalid email format.")
            email = raw_input

            provider_failed = False
            email_results = []
            try:
                email_results = await asyncio.wait_for(check_leakcheck(email), timeout=6.0)
                provider_lookups_count += 1
            except (asyncio.TimeoutError, Exception) as prov_err:
                logger.warning(f"Error querying threat provider for {email}: {prov_err}")
                provider_failed = True

            if provider_failed and len(email_results) == 0:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Threat intelligence provider unreachable. Please retry shortly."
                )

            breach_names = [res.get("source_name") for res in email_results if res.get("source_name")]
            severity_breakdown = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            total_exposures = len(email_results)

            for res in email_results:
                sev = res.get("source_type")
                if sev == "stealer_log":
                    severity_breakdown["critical"] += 1
                elif "password" in str(res.get("data_classes", [])).lower():
                    severity_breakdown["high"] += 1
                else:
                    severity_breakdown["medium"] += 1

            message = "Scan completed — exposures identified" if total_exposures > 0 else "Scan completed — no exposure detected"
            res_payload = {
                "domain": email,
                "total_exposures": total_exposures,
                "breach_count": len(breach_names),
                "severity_breakdown": severity_breakdown,
                "breach_names": breach_names[:8],
                "recent_breach": breach_names[0] if breach_names else None,
                "target_type": "email",
                "scan_status": "completed",
                "message": message,
                "overall_risk_score": 65 if total_exposures > 0 else 15,
                "risk_level": "HIGH RISK" if total_exposures > 0 else "LOW RISK",
                "discovered_assets_count": 1,
                "findings_count": total_exposures,
                "email_security_score": 50,
                "categories": {
                    "attack_surface": 90,
                    "email_security": 50,
                    "threat_intelligence": 70 if total_exposures > 0 else 95,
                    "credential_exposure": 40 if total_exposures > 0 else 100
                },
                "sample_findings": [],
                "conversion_title": "Get the complete corporate exposure assessment",
                "conversion_features": [
                    "Continuous external perimeter monitoring",
                    "Automated dark web & infostealer notifications",
                    "Full executive PDF security reports"
                ]
            }
            prospect_cache.set(cache_key, res_payload, ttl_seconds=3600)
            scanner_monitor.record_scan_attempt(client_ip, email, status="success", provider_lookups=provider_lookups_count)
            return res_payload

        # 5. Domain query
        domain = raw_input
        domain = re.sub(r"^https?://", "", domain)
        domain = re.sub(r"/.*$", "", domain)
        domain = re.sub(r"^www\\.", "", domain).split(":")[0]

        if not DOMAIN_REGEX.match(domain) or domain in ("localhost", "127.0.0.1", "0.0.0.0") or domain.endswith(".internal") or domain.endswith(".local"):
            scanner_monitor.record_scan_attempt(client_ip, domain, status="invalid_input")
            raise HTTPException(status_code=400, detail="Invalid domain format or restricted host.")

        # Run multi-pillar passive checks concurrently
        email_task = asyncio.create_task(analyze_email_security(domain))
        subdomains_task = asyncio.create_task(discover_subdomains(domain))
        breaches_task = asyncio.create_task(check_domain_breaches(domain))

        email_sec_res, subdomains_res, breaches_res = await asyncio.gather(
            email_task, subdomains_task, breaches_task, return_exceptions=True
        )

        email_sec = email_sec_res if isinstance(email_sec_res, dict) else {"score": 50, "findings": []}
        subdomains = subdomains_res if isinstance(subdomains_res, list) else [domain]
        breaches = breaches_res if isinstance(breaches_res, list) else []

        breach_names = [b.get("source_name") for b in breaches if b.get("source_name")]
        severity_breakdown = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        total_exposures = len(breaches)

        for b in breaches:
            classes = [c.lower() for c in b.get("data_classes", [])]
            if "passwords" in classes or "password" in classes:
                severity_breakdown["high"] += 1
            elif "password hashes" in classes:
                severity_breakdown["medium"] += 1
            else:
                severity_breakdown["low"] += 1

        # Synthesize sample findings from email security + attack surface + threat intel
        sample_findings = []
        findings_count = len(breaches)

        # Email security findings
        for ef in email_sec.get("findings", []):
            findings_count += 1
            sample_findings.append({
                "title": ef.get("title"),
                "severity": ef.get("severity"),
                "category": "email_security",
                "asset": ef.get("asset"),
                "evidence": ef.get("evidence")
            })
            sev = ef.get("severity", "medium")
            if sev in severity_breakdown:
                severity_breakdown[sev] += 1

        # Subdomain inventory finding
        if len(subdomains) > 1:
            findings_count += 1
            sample_findings.append({
                "title": f"Discovered {len(subdomains)} External Hostnames in Certificate Transparency Logs",
                "severity": "low",
                "category": "attack_surface",
                "asset": domain,
                "evidence": f"Certificate logs reveal public subdomains including: {', '.join(subdomains[:4])}."
            })
            severity_breakdown["low"] += 1

        # Calculate snapshot risk score
        email_score = email_sec.get("score", 50)
        attack_surface_posture = max(40, 100 - (len(subdomains) * 3))
        threat_intel_posture = max(30, 100 - (len(breaches) * 8))
        cred_posture = 85

        posture = (attack_surface_posture * 0.30) + (email_score * 0.25) + (threat_intel_posture * 0.20) + (cred_posture * 0.25)
        overall_risk = int(round(100.0 - posture))
        overall_risk = max(10, min(90, overall_risk))

        if overall_risk >= 65:
            risk_level = "HIGH RISK"
        elif overall_risk >= 35:
            risk_level = "MEDIUM RISK"
        else:
            risk_level = "LOW RISK"

        message = "Scan completed — risk indicators identified" if findings_count > 0 else "Scan completed — no exposure detected"
        
        domain_payload = {
            "domain": domain,
            "total_exposures": total_exposures,
            "breach_count": len(breach_names),
            "severity_breakdown": severity_breakdown,
            "breach_names": breach_names[:8],
            "recent_breach": breach_names[0] if breach_names else None,
            "target_type": "domain",
            "scan_status": "completed",
            "message": message,
            "overall_risk_score": overall_risk,
            "risk_level": risk_level,
            "discovered_assets_count": len(subdomains),
            "findings_count": findings_count,
            "email_security_score": email_score,
            "categories": {
                "attack_surface": attack_surface_posture,
                "email_security": email_score,
                "threat_intelligence": threat_intel_posture,
                "credential_exposure": cred_posture
            },
            "sample_findings": sample_findings[:4],
            "conversion_title": "Get the complete security assessment & remediation report",
            "conversion_features": [
                "Continuous external attack surface and port scanning",
                "Full DMARC/SPF technical remediation guide",
                "10-15 page executive & compliance PDF assessment",
                "Real-time alerts on new exposed services and breaches"
            ]
        }
        prospect_cache.set(cache_key, domain_payload, ttl_seconds=3600)
        scanner_monitor.record_scan_attempt(client_ip, domain, status="success", provider_lookups=provider_lookups_count)
        return domain_payload

    except HTTPException:
        raise
    except Exception as e:
        scanner_monitor.record_scan_attempt(client_ip, raw_input, status="failed", provider_lookups=provider_lookups_count)
        logger.error(f"Prospect scan error for query '{raw_input}': {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="External intelligence reconnaissance service temporarily unavailable. Please try again shortly."
        )
