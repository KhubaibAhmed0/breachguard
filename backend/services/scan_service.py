import logging
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.domain import MonitoredDomain, MonitoredEmail
from models.scan_job import ScanJob
from models.exposure import Exposure
from models.organization import Organization
from services.hibp_service import check_email_breaches, check_domain_breaches
from services.leakcheck_service import check_email as check_leakcheck
from services.alert_service import send_email_alert

logger = logging.getLogger(__name__)

from core.ssrf_guard import safe_http_post

async def send_webhook_alert(webhook_url: str, payload: dict) -> bool:
    try:
        resp = await safe_http_post(webhook_url, json_payload=payload, timeout=10.0)
        if resp.status_code >= 400:
            logger.warning(f"Webhook alert to {webhook_url} returned HTTP {resp.status_code}")
            return False
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch webhook alert safely: {e}")
        return False

def calculate_severity(exposure_data: Dict[str, Any]) -> str:
    cred_type = exposure_data.get("credential_type", "unknown")
    source_type = exposure_data.get("source_type", "")
    source_name = exposure_data.get("source_name", "").lower()
    data_classes = [c.lower() for c in exposure_data.get("data_classes", [])]
    
    # 1. CRITICAL: Plaintext credentials, infostealer malware, browser cookies, API keys
    has_cookies = any("cookie" in c for c in data_classes)
    has_tokens = any("token" in c or "key" in c for c in data_classes)
    is_stealer = "stealer" in source_name or source_type == "stealer_log"
    if cred_type == "plaintext" or is_stealer or has_cookies or has_tokens:
        return "critical"
    
    # 2. Check for passwords / hashes / financial data
    has_passwords = "passwords" in data_classes or "password" in data_classes or "password hashes" in data_classes
    has_financial = any(x in data_classes for x in ["credit cards", "bank account numbers", "payment histories"])
    
    if has_passwords or has_financial:
        breach_date = exposure_data.get("breach_date")
        if breach_date:
            try:
                # If breach is legacy (before or during 2016) with hashed passwords and no financial data, classify as MEDIUM
                year = int(breach_date.split("-")[0])
                if year <= 2016 and not has_financial:
                    return "medium"
            except Exception as parse_err:
                logger.debug(f"Date parsing skipped in calculate_severity: {parse_err}")
        return "high"
        
    # 3. MEDIUM: Password hints, security questions
    if "password hints" in data_classes or cred_type == "hint":
        return "medium"
        
    # 4. LOW: Metadata, email addresses, usernames, names, phone numbers only
    return "low"

async def run_domain_scan(domain_id: int, db: AsyncSession) -> Dict[str, Any]:
    # 1. Create a ScanJob record
    scan_job = ScanJob(domain_id=domain_id, status="running")
    db.add(scan_job)
    await db.commit()
    await db.refresh(scan_job)

    try:
        # Get domain
        result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.id == domain_id))
        domain = result.scalars().first()
        if not domain:
            raise ValueError(f"Domain {domain_id} not found")

        # 2. Get all MonitoredEmail records for the domain
        result = await db.execute(select(MonitoredEmail).where(MonitoredEmail.domain_id == domain_id))
        emails = list(result.scalars().all())
        
        if not emails:
            # Auto-seed standard corporate email if none exists
            default_email = MonitoredEmail(domain_id=domain.id, email=f"admin@{domain.domain}")
            db.add(default_email)
            await db.commit()
            await db.refresh(default_email)
            emails = [default_email]

        primary_email = emails[0]
        new_exposures_count = 0
        new_high_critical = []

        # 2b. Check domain-level breaches from HIBP (free public API)
        domain_breaches = await check_domain_breaches(domain.domain)
        for breach in domain_breaches:
            source = breach.get("source_name", "Unknown Breach")
            existing = await db.execute(
                select(Exposure).where(
                    Exposure.email_id == primary_email.id,
                    Exposure.source_name == source
                )
            )
            if not existing.scalars().first():
                severity = calculate_severity(breach)
                first_seen = None
                if breach.get("breach_date"):
                    try:
                        first_seen = datetime.fromisoformat(breach["breach_date"].replace("Z", "+00:00"))
                    except Exception as err:
                        logger.debug(f"Breach date ISO parse skipped: {err}")
                
                sanitized_meta = {
                    "provider": "hibp",
                    "source_name": source,
                    "evidence_type": "domain_breach",
                    "confidence": "high" if severity in ["critical", "high"] else "moderate",
                    "breach_date": breach.get("breach_date")
                }
                new_exp = Exposure(
                    email_id=primary_email.id,
                    org_id=domain.org_id,
                    source_name=source,
                    source_type=breach.get("source_type", "breach"),
                    data_classes=breach.get("data_classes", []),
                    severity=severity,
                    credential_type=breach.get("credential_type", "domain_breach"),
                    first_seen_at=first_seen,
                    raw_data=sanitized_meta
                )
                db.add(new_exp)
                new_exposures_count += 1
                if severity in ["high", "critical"]:
                    new_high_critical.append(new_exp)

        # 3. For each email, query sources (LeakCheck free public API + HIBP if key available)
        for email_record in emails:
            hibp_results = await check_email_breaches(email_record.email)
            leakcheck_results = await check_leakcheck(email_record.email)

            # 4. Normalize and merge
            all_results = hibp_results + leakcheck_results
            
            # Deduplicate incoming results by source_name
            merged_results = {}
            for res in all_results:
                source = res["source_name"]
                if source not in merged_results:
                    merged_results[source] = res
                else:
                    # Merge data classes
                    existing_classes = set(merged_results[source].get("data_classes", []))
                    new_classes = set(res.get("data_classes", []))
                    merged_results[source]["data_classes"] = list(existing_classes.union(new_classes))
                    
                    if res.get("credential_type") and merged_results[source].get("credential_type", "unknown") == "unknown":
                        merged_results[source]["credential_type"] = res["credential_type"]

            # 5. Deduplicate against existing Exposures
            for source, res in merged_results.items():
                existing = await db.execute(
                    select(Exposure).where(
                        Exposure.email_id == email_record.id,
                        Exposure.source_name == source
                    )
                )
                if existing.scalars().first():
                    continue # Already exists

                # 6. Calculate severity
                severity = calculate_severity(res)

                # 7. Insert new Exposure
                first_seen = None
                if res.get("breach_date"):
                    try:
                        first_seen = datetime.fromisoformat(res["breach_date"].replace("Z", "+00:00"))
                    except Exception as err:
                        logger.debug(f"Email breach date parse skipped: {err}")
                
                raw_meta = res.get("raw_data") or {}
                clean_meta = {
                    "provider": raw_meta.get("provider", "threat_intel"),
                    "source_name": source,
                    "evidence_type": raw_meta.get("evidence_type", res.get("source_type", "breach")),
                    "confidence": raw_meta.get("confidence", "high" if severity in ["critical", "high"] else "moderate"),
                    "has_credentials": bool(raw_meta.get("has_credentials", False)),
                    "compromise_date": res.get("breach_date")
                }
                new_exposure = Exposure(
                    email_id=email_record.id,
                    org_id=domain.org_id,
                    source_name=source,
                    source_type=res.get("source_type", "breach"),
                    data_classes=res.get("data_classes", []),
                    severity=severity,
                    credential_type=res.get("credential_type"),
                    first_seen_at=first_seen,
                    raw_data=clean_meta
                )
                db.add(new_exposure)
                new_exposures_count += 1

                if severity in ["high", "critical"]:
                    new_high_critical.append(new_exposure)

        await db.commit()

        # 8. Update ScanJob
        scan_job.status = "completed"
        scan_job.new_exposures_found = new_exposures_count
        scan_job.completed_at = datetime.utcnow()
        await db.commit()

        # 9. Notify via Email
        if new_high_critical:
            await send_email_alert(domain.org_id, new_high_critical, db)

        # 10. Webhook Alerts (Slack & SIEM)
        org_res = await db.execute(select(Organization).where(Organization.id == domain.org_id))
        org = org_res.scalars().first()
        if org and org.slack_webhook_url and new_exposures_count > 0:
            slack_payload = {
                "text": f"*BreachGuard Incident Alert*: {new_exposures_count} new exposure(s) detected for *{domain.domain}*! Severity: Critical/High. Review findings on BreachGuard dashboard."
            }
            await send_webhook_alert(org.slack_webhook_url, slack_payload)

        if org and org.siem_webhook_url and new_exposures_count > 0:
            siem_payload = {
                "event": "breachguard_incident_alert",
                "domain": domain.domain,
                "org_id": domain.org_id,
                "new_exposures_count": new_exposures_count,
                "timestamp": datetime.utcnow().isoformat()
            }
            await send_webhook_alert(org.siem_webhook_url, siem_payload)

        return {
            "status": "success",
            "domain_id": domain_id,
            "emails_scanned": len(emails),
            "new_exposures_found": new_exposures_count
        }

    except Exception as e:
        logger.error(f"Scan failed for domain {domain_id}: {str(e)}")
        scan_job.status = "failed"
        scan_job.completed_at = datetime.utcnow()
        await db.commit()
        return {"status": "error", "error": str(e)}
