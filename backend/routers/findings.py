from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime
import json

from core.database import get_db
from models.user import User
from models.finding import Finding
from routers.deps import get_current_user

router = APIRouter(prefix="/api/findings", tags=["findings"])

VALID_STATUSES = ["open", "acknowledged", "in_progress", "remediated", "accepted_risk", "false_positive"]

@router.get("")
async def get_all_findings(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    domain_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Finding).where(Finding.org_id == current_user.org_id)
    if category:
        query = query.where(Finding.category == category)
    if severity:
        query = query.where(Finding.severity == severity)
    if status:
        query = query.where(Finding.status == status)
    if domain_id:
        query = query.where(Finding.domain_id == domain_id)
        
    res = await db.execute(query.order_by(Finding.id.desc()))
    findings = res.scalars().all()
    
    out = []
    for f in findings:
        sources_list = []
        try:
            if f.sources:
                sources_list = json.loads(f.sources)
        except Exception:
            sources_list = [f.sources] if f.sources else []

        out.append({
            "id": f.id,
            "finding_id": f.finding_id,
            "domain_id": f.domain_id,
            "category": f.category,
            "title": f.title,
            "severity": f.severity,
            "status": f.status,
            "observed_status": f.observed_status,
            "confidence": f.confidence,
            "asset": f.asset,
            "evidence": f.evidence,
            "sources": sources_list,
            "description": f.description,
            "security_impact": f.security_impact,
            "recommended_remediation": f.recommended_remediation,
            "references": f.references,
            "first_observed_at": f.first_observed_at.isoformat() if f.first_observed_at else None,
            "last_observed_at": f.last_observed_at.isoformat() if f.last_observed_at else None
        })
    return out

@router.patch("/{id}/status")
async def update_finding_status(
    id: int,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_status = payload.get("status")
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")

    res = await db.execute(
        select(Finding).where(
            Finding.id == id,
            Finding.org_id == current_user.org_id
        )
    )
    finding = res.scalars().first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.status = new_status
    await db.commit()
    return {"status": "success", "id": finding.id, "new_status": finding.status}
