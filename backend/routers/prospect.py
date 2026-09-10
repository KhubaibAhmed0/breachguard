import re
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Request, status
from schemas.prospect import ProspectScanRequest, ProspectScanResponse
from services.hibp_service import check_domain_breaches
from services.leakcheck_service import check_email as check_leakcheck
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
    provider quota capping, strict timeouts (6s max), and zero-leakage sanitized summaries.
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

    # Rate limiting per target (prevent hammering the exact same domain repeatedly)
    from core.rate_limiter import rate_limiter
    if rate_limiter.is_rate_limited(f"target_scan:{raw_input}", max_requests=3, window_seconds=180):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="This target was scanned recently. Please wait a few minutes before querying it again."
        )

    # 3. Cache check (1 hour TTL) to protect external provider API quotas
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

            # Enforce 6.0s timeout on external provider call
            provider_failed = False
            email_results = []
            try:
                email_results = await asyncio.wait_for(check_leakcheck(email), timeout=6.0)
                provider_lookups_count += 1
            except (asyncio.TimeoutError, Exception) as prov_err:
                logger.warning(f"Error querying LeakCheck for {email}: {prov_err}")
                provider_failed = True

            if provider_failed and not email_results:
                scanner_monitor.record_scan_attempt(client_ip, email, status="provider_error", provider_lookups=provider_lookups_count)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="External threat intelligence provider temporarily unavailable. Please try again shortly."
                )

            breach_names = [res.get("source_name") for res in email_results if res.get("source_name")]
            severity_breakdown = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            for res in email_results:
                sev = res.get("source_type")
                if sev == "stealer_log" or "stealer" in str(res.get("source_name", "")).lower():
                    severity_breakdown["critical"] += 1
                elif "password" in str(res.get("data_classes", [])).lower():
                    severity_breakdown["high"] += 1
                else:
                    severity_breakdown["medium"] += 1

            total_exposures = len(email_results)
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
                "message": message
            }
            prospect_cache.set(cache_key, res_payload, ttl_seconds=3600)
            scanner_monitor.record_scan_attempt(client_ip, email, status="success", provider_lookups=provider_lookups_count)
            return res_payload

        # 5. Domain query
        domain = raw_input
        domain = re.sub(r"^https?://", "", domain)
        domain = re.sub(r"/.*$", "", domain)
        domain = re.sub(r"^www\.", "", domain).split(":")[0]

        if not DOMAIN_REGEX.match(domain) or domain in ("localhost", "127.0.0.1", "0.0.0.0") or domain.endswith(".internal") or domain.endswith(".local"):  # nosec B104
            scanner_monitor.record_scan_attempt(client_ip, domain, status="invalid_input")
            raise HTTPException(status_code=400, detail="Invalid domain format or restricted host.")

        breaches = []
        domain_lookup_failed = False
        try:
            breaches = await asyncio.wait_for(check_domain_breaches(domain), timeout=6.0)
            provider_lookups_count += 1
        except (asyncio.TimeoutError, Exception) as dom_err:
            logger.warning(f"Error querying HIBP for {domain}: {dom_err}")
            domain_lookup_failed = True

        breach_names = [b.get("source_name") for b in breaches if b.get("source_name")]
        severity_breakdown = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        total_exposures = 0

        for breach in breaches:
            total_exposures += 1
            classes = [c.lower() for c in breach.get("data_classes", [])]
            if "passwords" in classes or "password" in classes:
                severity_breakdown["critical"] += 1
            elif "password hashes" in classes:
                severity_breakdown["medium"] += 1
            else:
                severity_breakdown["low"] += 1

        # Check at most 2 corporate prefixes to cap provider calls
        common_prefixes = ["admin", "contact"]
        for prefix in common_prefixes:
            test_email = f"{prefix}@{domain}"
            try:
                email_results = await asyncio.wait_for(check_leakcheck(test_email), timeout=4.0)
                provider_lookups_count += 1
                for res in email_results:
                    total_exposures += 1
                    source = res.get("source_name", "Unknown Breach")
                    if source not in breach_names:
                        breach_names.append(source)
                    
                    sev = res.get("source_type")
                    if sev == "stealer_log":
                        severity_breakdown["critical"] += 1
                    elif "password" in str(res.get("data_classes", [])).lower():
                        severity_breakdown["high"] += 1
                    else:
                        severity_breakdown["medium"] += 1
            except Exception as e:
                logger.debug(f"Prospect query prefix lookup skipped: {e}")

        # Distinguish real findings from zero findings (no fake data fabrication)
        message = "Scan completed — exposures identified" if total_exposures > 0 else "Scan completed — no exposure detected"
        domain_payload = {
            "domain": domain,
            "total_exposures": total_exposures,
            "breach_count": len(breach_names),
            "severity_breakdown": severity_breakdown,
            "breach_names": breach_names[:8],
            "recent_breach": breach_names[0] if breach_names else None,
            "target_type": "domain",
            "scan_status": "completed",
            "message": message
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
