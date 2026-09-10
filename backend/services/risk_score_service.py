from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.exposure import Exposure
from datetime import datetime, timedelta

async def calculate_risk_score(org_id: int, db: AsyncSession) -> int:
    """
    Calculate 0-100 risk score for an organization.
    Base 100, deductions for active exposures, recovery for remediated.
    """
    result = await db.execute(select(Exposure).where(Exposure.org_id == org_id))
    exposures = result.scalars().all()

    score = 100.0
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)

    for exp in exposures:
        recency_multiplier = 1.0
        if exp.detected_at and exp.detected_at >= ninety_days_ago:
            recency_multiplier = 2.0

        if exp.status == "open":
            if exp.severity == "critical":
                score -= 5.0 * recency_multiplier
            elif exp.severity == "high":
                score -= 3.0 * recency_multiplier
            elif exp.severity == "medium":
                score -= 1.0 * recency_multiplier
        elif exp.status == "remediated":
            score += 2.0  # Recovery credit
            
    # Clamp to 0-100
    if score > 100:
        score = 100
    if score < 0:
        score = 0
        
    return int(score)
