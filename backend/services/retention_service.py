import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from models.organization import Organization
from models.exposure import Exposure
from models.alert import Alert

logger = logging.getLogger("breachguard.retention")

PLAN_RETENTION_DAYS = {
    "essential": 90,
    "starter": 90,
    "business": 365,
    "professional": 365,
    "enterprise": None,  # Unlimited
    "enterprise / msp": None  # Unlimited
}

async def enforce_retention_policy(db: AsyncSession) -> Dict[str, Any]:
    """
    Automated backend retention job:
    Enforces product retention commitments:
    - Starter / Essential: 90 days
    - Business: 365 days (1 year)
    - Enterprise: Unlimited
    """
    now = datetime.utcnow()
    total_purged = 0
    org_breakdown = {}

    org_res = await db.execute(select(Organization))
    orgs = org_res.scalars().all()

    for org in orgs:
        plan = (org.plan or "essential").lower()
        retention_days = PLAN_RETENTION_DAYS.get(plan, 90)

        if retention_days is None:
            # Enterprise unlimited retention
            continue

        cutoff_date = now - timedelta(days=retention_days)
        
        # Find exposures older than cutoff
        del_stmt = delete(Exposure).where(
            Exposure.org_id == org.id,
            Exposure.detected_at < cutoff_date
        )
        result = await db.execute(del_stmt)
        purged_count = result.rowcount or 0

        if purged_count > 0:
            total_purged += purged_count
            org_breakdown[org.id] = purged_count
            logger.info(f"[RETENTION_POLICY] Purged {purged_count} expired exposures for Org {org.id} ({plan}, cutoff: {cutoff_date.date()})")

    if total_purged > 0:
        await db.commit()
        logger.info(f"[RETENTION_POLICY] Retention cycle completed. Purged total {total_purged} expired exposures.")
    
    return {
        "status": "success",
        "total_purged": total_purged,
        "org_breakdown": org_breakdown,
        "executed_at": now.isoformat()
    }

async def purge_organization_history(org_id: int, db: AsyncSession) -> int:
    """
    On-demand organization data deletion workflow:
    Purges all exposure and alert intelligence records for an organization.
    """
    # 1. Delete alerts
    await db.execute(delete(Alert).where(Alert.org_id == org_id))
    
    # 2. Delete exposures
    exp_res = await db.execute(delete(Exposure).where(Exposure.org_id == org_id))
    purged_count = exp_res.rowcount or 0
    
    await db.commit()
    logger.warning(f"[DATA_PURGE] Organization {org_id} executed full history purge ({purged_count} records removed).")
    return purged_count
