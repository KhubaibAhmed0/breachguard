from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from core.database import get_db
from models.user import User
from models.exposure import Exposure
from models.domain import MonitoredEmail
from schemas.exposure import ExposureResponse, ExposureUpdate, ExposureStats
from routers.deps import get_current_user
from services.risk_score_service import calculate_risk_score
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter()

@router.get("", response_model=List[ExposureResponse])
async def list_exposures(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Exposure, MonitoredEmail.email)
        .outerjoin(MonitoredEmail, Exposure.email_id == MonitoredEmail.id)
        .where(Exposure.org_id == current_user.org_id)
    )
    if severity:
        query = query.where(Exposure.severity == severity)
    if status:
        query = query.where(Exposure.status == status)
    
    query = query.limit(limit).offset(offset).order_by(Exposure.detected_at.desc())
    result = await db.execute(query)
    rows = result.all()
    
    user_plan = (current_user.organization.plan if current_user.organization else "essential").lower()
    is_essential = user_plan in ["essential", "starter"]

    response = []
    for exp, email_addr in rows:
        resp_obj = ExposureResponse.model_validate(exp)
        resp_obj.email = email_addr or "domain-wide"

        # Tier gating: Infostealer intelligence restricted on essential tier
        src_name = (exp.source_name or "").lower()
        src_type = (exp.source_type or "").lower()
        is_stealer = (
            src_type == "stealer_log" 
            or "stealer" in src_name 
            or (exp.severity == "critical" and ("stealer" in (exp.credential_type or "").lower() or "cookie" in str(exp.data_classes).lower()))
        )

        if is_essential and is_stealer:
            resp_obj.upgrade_required = True
            resp_obj.credential_type = "REDACTED (UPGRADE REQUIRED)"
            resp_obj.data_classes = ["[PROTECTED] Infostealer Telemetry - Upgrade to Business Plan to unlock raw credentials & session cookies"]
            if resp_obj.email and "@" in resp_obj.email and resp_obj.email != "domain-wide":
                user_part, domain_part = resp_obj.email.split("@", 1)
                resp_obj.email = f"{user_part[:2]}***@{domain_part}"

        response.append(resp_obj)
    return response

@router.get("/stats", response_model=ExposureStats)
async def get_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Exposure).where(Exposure.org_id == current_user.org_id))
    exposures = result.scalars().all()
    
    total = len(exposures)
    by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_source = {}
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_in_30 = 0
    
    for e in exposures:
        by_severity[e.severity] = by_severity.get(e.severity, 0) + 1
        by_source[e.source_type] = by_source.get(e.source_type, 0) + 1
        if e.detected_at and e.detected_at >= thirty_days_ago:
            new_in_30 += 1
            
    risk_score = await calculate_risk_score(current_user.org_id, db)

    return {
        "total_exposures": total,
        "by_severity": by_severity,
        "by_source_type": by_source,
        "new_in_last_30_days": new_in_30,
        "risk_score": risk_score
    }

@router.patch("/{id}/status", response_model=ExposureResponse)
async def update_exposure_status(id: int, exp_in: ExposureUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Exposure).where(Exposure.id == id, Exposure.org_id == current_user.org_id))
    exp = result.scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Exposure not found")
    
    exp.status = exp_in.status
    await db.commit()
    await db.refresh(exp)

    email_res = await db.execute(select(MonitoredEmail.email).where(MonitoredEmail.id == exp.email_id))
    email_addr = email_res.scalar()

    resp_obj = ExposureResponse.model_validate(exp)
    resp_obj.email = email_addr or "domain-wide"
    return resp_obj

@router.get("/timeline")
async def get_timeline(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    data = [2, 5, 8, 4, 12, 6]
    return {"labels": months, "data": data}
