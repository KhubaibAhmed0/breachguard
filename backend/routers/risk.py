from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from core.database import get_db
from models.user import User
from models.asset import RiskAssessment, DiscoveredAsset
from models.finding import Finding
from models.exposure import Exposure
from routers.deps import get_current_user

router = APIRouter(prefix="/api/risk", tags=["risk"])

@router.get("/overview")
async def get_risk_overview(
    domain_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch latest RiskAssessment
    query = select(RiskAssessment).where(RiskAssessment.org_id == current_user.org_id)
    if domain_id:
        query = query.where(RiskAssessment.domain_id == domain_id)
    
    res = await db.execute(query.order_by(RiskAssessment.id.desc()))
    latest_assessment = res.scalars().first()
    
    # Counts
    f_res = await db.execute(select(Finding).where(Finding.org_id == current_user.org_id))
    findings = f_res.scalars().all()
    
    open_findings = [f for f in findings if f.status == "open"]
    crit_count = sum(1 for f in open_findings if f.severity == "critical")
    high_count = sum(1 for f in open_findings if f.severity == "high")
    med_count = sum(1 for f in open_findings if f.severity == "medium")
    low_count = sum(1 for f in open_findings if f.severity == "low")
    
    # Assets count
    a_res = await db.execute(select(DiscoveredAsset).where(DiscoveredAsset.org_id == current_user.org_id))
    assets_count = len(a_res.scalars().all())
    
    # Exposed identities count
    e_res = await db.execute(select(Exposure).where(Exposure.org_id == current_user.org_id))
    exposures = e_res.scalars().all()
    unique_emails = len(set(e.email_id for e in exposures))

    if latest_assessment:
        return {
            "overall_risk_score": latest_assessment.overall_score,
            "risk_level": latest_assessment.risk_level,
            "categories": {
                "attack_surface": latest_assessment.attack_surface_score,
                "email_security": latest_assessment.email_security_score,
                "threat_intelligence": latest_assessment.threat_intel_score,
                "credential_exposure": latest_assessment.credential_score
            },
            "summary": {
                "discovered_assets": assets_count,
                "open_findings": len(open_findings),
                "critical_findings": crit_count,
                "high_findings": high_count,
                "medium_findings": med_count,
                "low_findings": low_count,
                "exposed_identities": unique_emails,
                "email_score": latest_assessment.email_security_score
            },
            "last_assessed_at": latest_assessment.created_at.isoformat() if latest_assessment.created_at else None
        }
    else:
        return {
            "overall_risk_score": 15,
            "risk_level": "LOW RISK",
            "categories": {
                "attack_surface": 95,
                "email_security": 80,
                "threat_intelligence": 90,
                "credential_exposure": 95
            },
            "summary": {
                "discovered_assets": assets_count,
                "open_findings": len(open_findings),
                "critical_findings": crit_count,
                "high_findings": high_count,
                "medium_findings": med_count,
                "low_findings": low_count,
                "exposed_identities": unique_emails,
                "email_score": 80
            },
            "last_assessed_at": None
        }
