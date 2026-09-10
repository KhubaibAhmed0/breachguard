from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from models.user import User
from models.organization import Organization
from models.domain import MonitoredDomain, MonitoredEmail
from routers.deps import get_current_user

router = APIRouter()

class IdentityCreate(BaseModel):
    domain_id: int
    email: str

class IdentityItem(BaseModel):
    id: int
    email: str
    domain: str
    domain_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class IdentityListResponse(BaseModel):
    identities: List[IdentityItem]
    used_count: int
    quota_limit: int
    plan: str

def get_quota_for_plan(plan: str) -> int:
    p = (plan or "essential").lower()
    if p in ["essential", "starter"]:
        return 5
    elif p in ["business", "professional"]:
        return 25
    elif p in ["enterprise", "enterprise / msp"]:
        return -1
    return 5

@router.get("", response_model=IdentityListResponse)
async def list_privileged_identities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all MonitoredEmail where domain.org_id == current_user.org_id and is_vip == True.
    Returns identities list, used_count, quota_limit, and plan.
    """
    query = (
        select(MonitoredEmail, MonitoredDomain.domain)
        .join(MonitoredDomain, MonitoredEmail.domain_id == MonitoredDomain.id)
        .where(
            MonitoredDomain.org_id == current_user.org_id,
            MonitoredEmail.is_vip == True
        )
        .order_by(MonitoredEmail.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    identities = [
        IdentityItem(
            id=email_rec.id,
            email=email_rec.email,
            domain=domain_name,
            domain_id=email_rec.domain_id,
            created_at=email_rec.created_at or datetime.utcnow()
        )
        for email_rec, domain_name in rows
    ]

    plan = current_user.organization.plan if current_user.organization else "essential"
    quota_limit = get_quota_for_plan(plan)

    return IdentityListResponse(
        identities=identities,
        used_count=len(identities),
        quota_limit=quota_limit,
        plan=plan
    )

@router.post("", response_model=IdentityItem)
async def create_privileged_identity(
    data: IdentityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new privileged identity:
    - Validates domain belongs to user's org.
    - Enforces tier quota: Essential = 5 max, Business = 25 max, Enterprise = unlimited.
    - Adds MonitoredEmail(domain_id=domain_id, email=email, is_vip=True).
    """
    # 1. Validate domain belongs to user's org
    domain_res = await db.execute(
        select(MonitoredDomain).where(
            MonitoredDomain.id == data.domain_id,
            MonitoredDomain.org_id == current_user.org_id
        )
    )
    domain = domain_res.scalars().first()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found or does not belong to your organization"
        )

    # 2. Check current VIP count for this org
    count_res = await db.execute(
        select(func.count(MonitoredEmail.id))
        .join(MonitoredDomain, MonitoredEmail.domain_id == MonitoredDomain.id)
        .where(
            MonitoredDomain.org_id == current_user.org_id,
            MonitoredEmail.is_vip == True
        )
    )
    used_count = count_res.scalar() or 0

    plan = current_user.organization.plan if current_user.organization else "essential"
    quota_limit = get_quota_for_plan(plan)

    if quota_limit != -1 and used_count >= quota_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Privileged identity quota reached for this plan. Please upgrade."
        )

    clean_email = data.email.strip().lower()

    # 3. Check if email already exists for this domain
    existing_res = await db.execute(
        select(MonitoredEmail).where(
            MonitoredEmail.domain_id == domain.id,
            MonitoredEmail.email == clean_email
        )
    )
    email_rec = existing_res.scalars().first()
    if email_rec:
        email_rec.is_vip = True
    else:
        email_rec = MonitoredEmail(
            domain_id=domain.id,
            email=clean_email,
            is_vip=True
        )
        db.add(email_rec)

    await db.commit()
    await db.refresh(email_rec)

    return IdentityItem(
        id=email_rec.id,
        email=email_rec.email,
        domain=domain.domain,
        domain_id=domain.id,
        created_at=email_rec.created_at or datetime.utcnow()
    )

@router.delete("/{id}")
async def delete_privileged_identity(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete or unmark privileged identity.
    """
    res = await db.execute(
        select(MonitoredEmail, MonitoredDomain)
        .join(MonitoredDomain, MonitoredEmail.domain_id == MonitoredDomain.id)
        .where(
            MonitoredEmail.id == id,
            MonitoredDomain.org_id == current_user.org_id
        )
    )
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Privileged identity not found"
        )

    email_rec, _ = row
    email_rec.is_vip = False
    await db.commit()

    return {"status": "success", "message": "Privileged identity removed", "id": id}
