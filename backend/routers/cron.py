import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from core.config import settings
from core.database import get_db
from models.domain import MonitoredDomain
from services.scan_service import run_domain_scan

logger = logging.getLogger("breachguard.cron")

router = APIRouter()

import secrets

def verify_cron_auth(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None),
    secret: Optional[str] = Query(None)
):
    """
    Authenticates incoming serverless or external scheduler trigger with CRON_SECRET (BG-SEC-06).
    Fails closed if CRON_SECRET is unconfigured.
    """
    configured_secret = settings.CRON_SECRET
    if not configured_secret:
        logger.error("[CRON] Scheduled scan trigger refused: CRON_SECRET is not configured on the server.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scheduled scan execution is currently disabled (CRON_SECRET unconfigured)."
        )

    # Check Authorization: Bearer <secret>
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if secrets.compare_digest(token, configured_secret):
            return True

    # Check X-Cron-Secret header
    if x_cron_secret and secrets.compare_digest(x_cron_secret, configured_secret):
        return True

    # Check query param
    if secret and secrets.compare_digest(secret, configured_secret):
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized cron execution. Valid CRON_SECRET required."
    )

@router.get("/scans")
@router.post("/scans")
async def execute_scheduled_scans(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_cron_auth)
):
    """
    Serverless and Cloud-compatible cron endpoint.
    Finds all domains due for scheduled scanning and executes active surveillance.
    Supports continuous (1h), daily (24h), and weekly (7d) cadences.
    """
    now = datetime.utcnow()
    logger.info("[CRON] Scheduled scans evaluation cycle triggered.")

    # Retention enforcement sweep
    try:
        from services.retention_service import enforce_retention_policy
        await enforce_retention_policy(db)
    except Exception as ret_err:
        logger.error(f"[CRON] Retention enforcement sweep failed: {ret_err}")

    result = await db.execute(select(MonitoredDomain))
    domains_list = result.scalars().all()

    scanned_domains = []
    failed_domains = []

    for domain in domains_list:
        needs_scan = False
        if not domain.last_scanned_at:
            needs_scan = True
        elif domain.scan_frequency == "continuous" and (now - domain.last_scanned_at) >= timedelta(hours=1):
            needs_scan = True
        elif domain.scan_frequency == "daily" and (now - domain.last_scanned_at) >= timedelta(hours=24):
            needs_scan = True
        elif domain.scan_frequency == "weekly" and (now - domain.last_scanned_at) >= timedelta(days=7):
            needs_scan = True

        if needs_scan:
            try:
                logger.info(f"[CRON] Executing scan for domain {domain.domain} (id: {domain.id})")
                await run_domain_scan(domain.id, db)
                domain.last_scanned_at = datetime.utcnow()
                await db.commit()
                scanned_domains.append(domain.domain)
            except Exception as e:
                logger.error(f"[CRON] Scan error on {domain.domain}: {e}")
                failed_domains.append({"domain": domain.domain, "error": str(e)})

    return {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat(),
        "domains_scanned_count": len(scanned_domains),
        "scanned_domains": scanned_domains,
        "failed_count": len(failed_domains),
        "failures": failed_domains
    }
