from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional

from core.database import get_db
from models.user import User
from models.domain import MonitoredDomain
from models.asset import RiskAssessment, DiscoveredAsset, EmailSecurityAssessment
from models.finding import Finding
from models.exposure import Exposure
from routers.deps import get_current_user
from services.unified_risk_engine import compute_unified_risk

router = APIRouter(prefix="/api/risk", tags=["risk"])

@router.get("/overview")
async def get_risk_overview(
    domain_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Check monitored domains count
    d_query = select(func.count(MonitoredDomain.id)).where(MonitoredDomain.org_id == current_user.org_id)
    if domain_id:
        d_query = d_query.where(MonitoredDomain.id == domain_id)
    d_res = await db.execute(d_query)
    monitored_domains_count = d_res.scalar() or 0

    # If organization has zero monitored domains, strictly return unassessed zero-state
    if monitored_domains_count == 0:
        return {
            "overall_risk_score": 0,
            "risk_level": "NOT ASSESSED",
            "risk_color": "#71717A",
            "categories": {
                "attack_surface": 0,
                "email_security": 0,
                "threat_intelligence": 0,
                "credential_exposure": 0
            },
            "summary": {
                "discovered_assets": 0,
                "open_findings": 0,
                "critical_findings": 0,
                "high_findings": 0,
                "medium_findings": 0,
                "low_findings": 0,
                "exposed_identities": 0,
                "email_score": 0,
                "monitored_domains": 0
            },
            "scoring_breakdown": None,
            "assessed": False,
            "last_assessed_at": None
        }

    # 2. Fetch live discovered assets
    a_query = select(DiscoveredAsset).where(DiscoveredAsset.org_id == current_user.org_id)
    if domain_id:
        a_query = a_query.where(DiscoveredAsset.domain_id == domain_id)
    a_res = await db.execute(a_query)
    assets = a_res.scalars().all()
    assets_count = len(assets)

    # 3. Fetch live findings
    f_query = select(Finding).where(Finding.org_id == current_user.org_id)
    if domain_id:
        f_query = f_query.where(Finding.domain_id == domain_id)
    f_res = await db.execute(f_query)
    findings = f_res.scalars().all()
    
    open_findings = [f for f in findings if f.status == "open"]
    crit_count = sum(1 for f in open_findings if f.severity == "critical")
    high_count = sum(1 for f in open_findings if f.severity == "high")
    med_count = sum(1 for f in open_findings if f.severity == "medium")
    low_count = sum(1 for f in open_findings if f.severity == "low")

    # 4. Fetch live exposures
    e_query = select(Exposure).where(Exposure.org_id == current_user.org_id)
    e_res = await db.execute(e_query)
    exposures = e_res.scalars().all()
    unique_emails = len(set(e.email_id for e in exposures if e.email_id))

    # 5. Fetch latest email security assessment
    eml_query = select(EmailSecurityAssessment).where(EmailSecurityAssessment.org_id == current_user.org_id)
    if domain_id:
        eml_query = eml_query.where(EmailSecurityAssessment.domain_id == domain_id)
    eml_res = await db.execute(eml_query.order_by(EmailSecurityAssessment.id.desc()))
    latest_eml = eml_res.scalars().first()
    email_score = latest_eml.score if latest_eml else 100
    email_sec_details = {
        "spf_status": getattr(latest_eml, "spf_status", "pass"),
        "dmarc_policy": getattr(latest_eml, "dmarc_policy", "none") if latest_eml else "reject"
    } if latest_eml else None

    # 6. Format findings for unified risk engine
    as_findings_list = [
        {
            "finding_id": f.finding_id,
            "category": f.category,
            "title": f.title,
            "severity": f.severity,
            "asset": f.asset,
            "evidence": f.evidence,
            "description": f.description
        } for f in open_findings if f.category == "attack_surface"
    ]
    
    ti_findings_list = [
        {
            "finding_id": f.finding_id,
            "category": f.category,
            "title": f.title,
            "severity": f.severity,
            "asset": f.asset,
            "evidence": f.evidence,
            "description": f.description
        } for f in open_findings if f.category == "threat_intel"
    ]

    # Count distinct breach events
    breach_count = len([f for f in ti_findings_list if "breach" in f.get("title", "").lower()])

    # Compute live, mathematically consistent risk and audit trail
    risk_data = compute_unified_risk(
        attack_surface_findings=as_findings_list,
        assets_count=assets_count,
        email_sec_score=email_score,
        threat_intel_findings=ti_findings_list,
        breaches_count=breach_count,
        exposures=exposures,
        email_sec_details=email_sec_details
    )

    # 7. Query latest RiskAssessment timestamp if available
    ra_query = select(RiskAssessment).where(RiskAssessment.org_id == current_user.org_id)
    if domain_id:
        ra_query = ra_query.where(RiskAssessment.domain_id == domain_id)
    ra_res = await db.execute(ra_query.order_by(RiskAssessment.id.desc()))
    latest_ra = ra_res.scalars().first()
    last_assessed = latest_ra.created_at.isoformat() if (latest_ra and latest_ra.created_at) else None

    return {
        "overall_risk_score": risk_data["overall_risk_score"],
        "risk_level": risk_data["risk_level"],
        "risk_color": risk_data["risk_color"],
        "categories": risk_data["categories"],
        "summary": {
            "discovered_assets": assets_count,
            "open_findings": len(open_findings),
            "critical_findings": crit_count,
            "high_findings": high_count,
            "medium_findings": med_count,
            "low_findings": low_count,
            "exposed_identities": unique_emails,
            "email_score": email_score,
            "monitored_domains": monitored_domains_count
        },
        "scoring_breakdown": risk_data["scoring_breakdown"],
        "assessed": True,
        "last_assessed_at": last_assessed
    }
