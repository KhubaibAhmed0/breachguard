from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from core.database import get_db
from models.user import User
from models.organization import Organization
from models.domain import MonitoredDomain, MonitoredEmail
from models.exposure import Exposure
from models.scan_job import ScanJob
from schemas.domain import DomainCreate, DomainResponse, DomainScanStatus
from routers.deps import get_current_user
from services.scan_service import run_domain_scan
from datetime import datetime
from typing import List

router = APIRouter()

@router.post("", response_model=DomainResponse)
async def add_domain(domain_in: DomainCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    clean_domain = domain_in.domain.strip().lower()
    clean_domain = clean_domain.replace("https://", "").replace("http://", "").split("/")[0]

    # Check if already exists for this org
    result = await db.execute(
        select(MonitoredDomain).where(
            MonitoredDomain.org_id == current_user.org_id,
            MonitoredDomain.domain == clean_domain
        )
    )
    domain = result.scalars().first()
    if not domain:
        # Enforce subscription tier domain quota
        org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
        org = org_res.scalars().first()
        plan = (org.plan if org else "essential").lower()
        
        PLAN_LIMITS = {
            "essential": 1,
            "starter": 1,
            "business": 3,
            "enterprise": 15,
            "enterprise / msp": 15
        }
        max_domains = PLAN_LIMITS.get(plan, 1)

        count_res = await db.execute(
            select(func.count(MonitoredDomain.id)).where(MonitoredDomain.org_id == current_user.org_id)
        )
        current_count = count_res.scalar() or 0
        if current_count >= max_domains:
            raise HTTPException(
                status_code=403, 
                detail=f"Domain quota exceeded ({max_domains} max) for {plan.title()} plan. Please upgrade to monitor additional domains."
            )

        domain = MonitoredDomain(
            org_id=current_user.org_id,
            domain=clean_domain,
            scan_frequency=domain_in.scan_frequency,
            verified=False
        )
        db.add(domain)
        await db.commit()
        await db.refresh(domain)

        # Seed initial monitored corporate emails for exposure scanning
        default_emails = [
            f"admin@{clean_domain}",
            f"security@{clean_domain}",
            f"contact@{clean_domain}"
        ]
        for email_addr in default_emails:
            db.add(MonitoredEmail(domain_id=domain.id, email=email_addr))
        await db.commit()

    resp = DomainResponse.model_validate(domain)
    resp.exposure_count = 0
    return resp

@router.get("", response_model=List[DomainResponse])
async def list_domains(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.org_id == current_user.org_id))
    domains = result.scalars().all()
    
    response = []
    for d in domains:
        # Calculate exposure count for domain's emails
        count_res = await db.execute(
            select(func.count(Exposure.id))
            .join(MonitoredEmail, Exposure.email_id == MonitoredEmail.id)
            .where(MonitoredEmail.domain_id == d.id)
        )
        count = count_res.scalar() or 0
        resp_obj = DomainResponse.model_validate(d)
        resp_obj.exposure_count = count
        response.append(resp_obj)
    return response

@router.post("/{id}/verify")
async def verify_domain(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.id == id, MonitoredDomain.org_id == current_user.org_id))
    domain = result.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    domain.verified = True
    await db.commit()
    return {"status": "verified", "domain": domain.domain}

@router.post("/{id}/scan")
async def trigger_scan(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.id == id, MonitoredDomain.org_id == current_user.org_id))
    domain = result.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    # Run scan synchronously and record findings
    scan_result = await run_domain_scan(domain.id, db)
    domain.last_scanned_at = datetime.utcnow()
    await db.commit()
    
    return scan_result

@router.get("/{id}/status", response_model=DomainScanStatus)
async def get_scan_status(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ScanJob).where(ScanJob.domain_id == id).order_by(ScanJob.id.desc()))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="No scan job found")
    return job
