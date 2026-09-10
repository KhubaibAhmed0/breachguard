from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import json

from core.database import get_db
from models.user import User
from models.domain import MonitoredDomain
from models.asset import EmailSecurityAssessment
from models.finding import Finding
from routers.deps import get_current_user
from services.email_security import analyze_email_security

router = APIRouter(prefix="/api/email-security", tags=["email-security"])

@router.get("")
async def get_email_assessments(
    domain_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(EmailSecurityAssessment).where(EmailSecurityAssessment.org_id == current_user.org_id)
    if domain_id:
        query = query.where(EmailSecurityAssessment.domain_id == domain_id)
        
    res = await db.execute(query.order_by(EmailSecurityAssessment.id.desc()))
    assessments = res.scalars().all()
    
    out = []
    for a in assessments:
        mx_records = []
        try:
            if a.mx_records:
                mx_records = json.loads(a.mx_records)
        except Exception:
            pass

        out.append({
            "id": a.id,
            "domain_id": a.domain_id,
            "domain": a.domain,
            "score": a.score,
            "spf": {
                "status": a.spf_status,
                "record": a.spf_record,
                "details": a.spf_details
            },
            "dmarc": {
                "status": a.dmarc_status,
                "record": a.dmarc_record,
                "policy": a.dmarc_policy,
                "details": a.dmarc_details
            },
            "dkim": {
                "status": a.dkim_status,
                "details": a.dkim_details
            },
            "mx": {
                "status": a.mx_status,
                "records": mx_records
            },
            "mta_sts": {
                "status": a.mta_sts_status
            },
            "tls_rpt": {
                "status": a.tls_rpt_status
            },
            "dnssec": {
                "status": a.dnssec_status
            },
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return out

@router.post("/scan/{domain_id}")
async def trigger_email_scan(
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(MonitoredDomain).where(
            MonitoredDomain.id == domain_id,
            MonitoredDomain.org_id == current_user.org_id
        )
    )
    domain = res.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    sec_res = await analyze_email_security(domain.domain)
    
    assessment = EmailSecurityAssessment(
        org_id=domain.org_id,
        domain_id=domain.id,
        domain=domain.domain,
        spf_status=sec_res.get("spf", {}).get("status", "fail"),
        spf_record=sec_res.get("spf", {}).get("record"),
        spf_details=sec_res.get("spf", {}).get("details"),
        dmarc_status=sec_res.get("dmarc", {}).get("status", "fail"),
        dmarc_record=sec_res.get("dmarc", {}).get("record"),
        dmarc_policy=sec_res.get("dmarc", {}).get("policy"),
        dmarc_details=sec_res.get("dmarc", {}).get("details"),
        dkim_status=sec_res.get("dkim", {}).get("status", "not_verifiable"),
        dkim_details=sec_res.get("dkim", {}).get("details"),
        mx_status=sec_res.get("mx", {}).get("status", "fail"),
        mx_records=json.dumps(sec_res.get("mx", {}).get("records", [])),
        mta_sts_status=sec_res.get("mta_sts", {}).get("status", "not_detected"),
        tls_rpt_status=sec_res.get("tls_rpt", {}).get("status", "not_detected"),
        dnssec_status=sec_res.get("dnssec", {}).get("status", "not_detected"),
        score=sec_res.get("score", 0)
    )
    db.add(assessment)
    await db.commit()
    
    return {"status": "success", "score": sec_res.get("score", 0), "details": sec_res}
