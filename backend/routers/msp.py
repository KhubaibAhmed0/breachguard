from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

from core.database import get_db
from core.security import create_access_token
from models.user import User
from models.organization import Organization
from models.domain import MonitoredDomain
from models.exposure import Exposure
from schemas.msp import TenantCreate, TenantResponse, SwitchTenantResponse
from routers.deps import get_current_user

router = APIRouter()

def verify_msp_access(current_user: User):
    """
    Validates current_user.organization.is_msp or current_user.organization.plan in ['enterprise', 'enterprise / msp'].
    """
    org = current_user.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MSP operations require an active organization context."
        )
    plan = (org.plan or "").lower()
    is_authorized = bool(org.is_msp or plan in ["enterprise", "enterprise / msp"])
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MSP tenant management is restricted to Enterprise and MSP partner accounts. Please upgrade."
        )

@router.get("/tenants", response_model=List[TenantResponse])
async def list_msp_tenants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns list of child organizations where parent_org_id == current_user.org_id
    with domain count and exposure count for each child tenant.
    """
    verify_msp_access(current_user)

    parent_id = current_user.org_id

    res = await db.execute(
        select(Organization)
        .where(Organization.parent_org_id == parent_id)
        .order_by(Organization.id.asc())
    )
    children = res.scalars().all()

    tenant_list = []
    for child in children:
        dom_res = await db.execute(
            select(func.count(MonitoredDomain.id)).where(MonitoredDomain.org_id == child.id)
        )
        exp_res = await db.execute(
            select(func.count(Exposure.id)).where(Exposure.org_id == child.id)
        )

        tenant_list.append(TenantResponse(
            id=child.id,
            name=child.name,
            plan=child.plan or "enterprise",
            parent_org_id=child.parent_org_id,
            domains_count=dom_res.scalar() or 0,
            exposures_count=exp_res.scalar() or 0,
            logo_path=child.logo_path,
            created_at=child.created_at or datetime.utcnow()
        ))

    return tenant_list

@router.post("/tenants", response_model=TenantResponse)
async def create_msp_tenant(
    data: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates new Organization(name=name, plan="enterprise", is_msp=False, parent_org_id=current_user.org_id).
    Enforces total domain limit across all MSP tenants (max 15 domains).
    """
    verify_msp_access(current_user)

    parent_id = current_user.org_id

    # Enforce total domain limit across all MSP tenants (max 15 domains)
    child_ids_res = await db.execute(
        select(Organization.id).where(Organization.parent_org_id == parent_id)
    )
    managed_org_ids = [parent_id] + list(child_ids_res.scalars().all())

    total_dom_res = await db.execute(
        select(func.count(MonitoredDomain.id)).where(MonitoredDomain.org_id.in_(managed_org_ids))
    )
    total_domains = total_dom_res.scalar() or 0

    if total_domains >= 15:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Total domain limit across all MSP tenants reached (max 15 domains). Contact sales for enterprise expansion."
        )

    clean_name = data.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant name cannot be blank."
        )

    new_tenant = Organization(
        name=clean_name,
        plan="enterprise",
        is_msp=False,
        parent_org_id=parent_id
    )
    db.add(new_tenant)
    await db.commit()
    await db.refresh(new_tenant)

    return TenantResponse(
        id=new_tenant.id,
        name=new_tenant.name,
        plan=new_tenant.plan,
        parent_org_id=new_tenant.parent_org_id,
        domains_count=0,
        exposures_count=0,
        logo_path=new_tenant.logo_path,
        created_at=new_tenant.created_at or datetime.utcnow()
    )

@router.post("/switch-tenant/{tenant_id}", response_model=SwitchTenantResponse)
async def switch_tenant(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validates tenant belongs to MSP.
    Returns new scoped JWT token for the tenant organization or tenant details.
    """
    verify_msp_access(current_user)

    parent_id = current_user.org_id

    if tenant_id == parent_id:
        target_org = current_user.organization
    else:
        res = await db.execute(
            select(Organization).where(
                Organization.id == tenant_id,
                Organization.parent_org_id == parent_id
            )
        )
        target_org = res.scalars().first()

    if not target_org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant organization not found or unauthorized."
        )

    scoped_token = create_access_token(
        subject=current_user.id,
        extra_claims={"org_id": target_org.id}
    )

    return SwitchTenantResponse(
        access_token=scoped_token,
        token_type="bearer",  # nosec B106
        tenant={
            "id": target_org.id,
            "name": target_org.name,
            "plan": target_org.plan,
            "parent_org_id": target_org.parent_org_id,
            "is_msp": bool(target_org.is_msp)
        }
    )
