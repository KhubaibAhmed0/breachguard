from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete
from core.database import get_db
from models.user import User
from models.organization import Organization
from models.domain import MonitoredDomain, MonitoredEmail
from models.exposure import Exposure
from models.scan_job import ScanJob
from models.asset import DiscoveredAsset, EmailSecurityAssessment, RiskAssessment
from models.finding import Finding
from schemas.domain import DomainCreate, DomainUpdate, DomainResponse, DomainScanStatus, VerificationRecordResponse
from routers.deps import get_current_user, require_scope
from services.scan_service import run_domain_scan
from datetime import datetime
from typing import List
import re
import secrets
import os
import dns.asyncresolver

DOMAIN_REGEX = re.compile(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$")

router = APIRouter()

@router.post("", response_model=DomainResponse)
async def add_domain(domain_in: DomainCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_scope("write:domains"))):
    if current_user.role not in ("admin", "analyst"):
        raise HTTPException(
            status_code=403,
            detail="Only organization administrators and analysts can add monitored domains."
        )

    clean_domain = domain_in.domain.strip().lower()
    clean_domain = clean_domain.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]

    # Validate domain string
    if len(clean_domain) > 253 or not DOMAIN_REGEX.match(clean_domain):
        raise HTTPException(
            status_code=400,
            detail="Invalid domain format. Must be a valid FQDN (e.g. example.com) without protocols or ports."
        )

    # Prevent loopback or internal names
    if clean_domain in ("localhost", "127.0.0.1", "0.0.0.0") or clean_domain.endswith(".local") or clean_domain.endswith(".internal"):  # nosec B104
        raise HTTPException(status_code=400, detail="Internal or localhost domains are prohibited.")

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
            "professional": 3,
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

        token = f"bg-verify-{secrets.token_hex(16)}"
        domain = MonitoredDomain(
            org_id=current_user.org_id,
            domain=clean_domain,
            scan_frequency=domain_in.scan_frequency,
            verified=False,
            verification_token=token
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

    try:
        from routers.risk import invalidate_risk_cache
        invalidate_risk_cache(current_user.org_id)
    except Exception:
        pass

    resp = DomainResponse.model_validate(domain)
    resp.exposure_count = 0
    return resp

@router.get("", response_model=List[DomainResponse])
async def list_domains(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_scope("read:domains"))):
    result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.org_id == current_user.org_id))
    domains = result.scalars().all()
    
    # Single batch aggregation query for all domains in this organization
    domain_ids = [d.id for d in domains]
    counts_map = {}
    if domain_ids:
        counts_res = await db.execute(
            select(MonitoredEmail.domain_id, func.count(Exposure.id))
            .join(Exposure, Exposure.email_id == MonitoredEmail.id)
            .where(MonitoredEmail.domain_id.in_(domain_ids))
            .group_by(MonitoredEmail.domain_id)
        )
        counts_map = dict(counts_res.all())

    response = []
    has_updates = False
    for d in domains:
        if not d.verification_token:
            d.verification_token = f"bg-verify-{secrets.token_hex(16)}"
            db.add(d)
            has_updates = True
        count = counts_map.get(d.id, 0)
        resp_obj = DomainResponse.model_validate(d)
        resp_obj.exposure_count = count
        response.append(resp_obj)
    if has_updates:
        await db.commit()
    return response

@router.get("/{id}/verification-record", response_model=VerificationRecordResponse)
async def get_verification_record(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.id == id, MonitoredDomain.org_id == current_user.org_id))
    domain = result.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    if not domain.verification_token:
        domain.verification_token = f"bg-verify-{secrets.token_hex(16)}"
        await db.commit()
        await db.refresh(domain)
        
    return VerificationRecordResponse(
        domain=domain.domain,
        record_type="TXT",
        host=f"_breachguard-verify.{domain.domain}",
        value=f"breachguard-site-verification={domain.verification_token}",
        verified=bool(domain.verified),
        instructions=f"Add a DNS TXT record for host '_breachguard-verify.{domain.domain}' or '@' with value 'breachguard-site-verification={domain.verification_token}'."
    )

@router.post("/{id}/verify")
async def verify_domain(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.id == id, MonitoredDomain.org_id == current_user.org_id))
    domain = result.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    if domain.verified:
        return {"status": "verified", "domain": domain.domain, "message": "Domain is already verified."}

    if not domain.verification_token:
        domain.verification_token = f"bg-verify-{secrets.token_hex(16)}"
        await db.commit()

    expected_value = f"breachguard-site-verification={domain.verification_token}"
    targets = [f"_breachguard-verify.{domain.domain}", domain.domain]
    found_records = []
    is_verified = False

    resolver = dns.asyncresolver.Resolver()
    resolver.timeout = 4.0
    resolver.lifetime = 4.0
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"]

    for target in targets:
        try:
            answers = await resolver.resolve(target, "TXT")
            for rdata in answers:
                for txt_bytes in rdata.strings:
                    txt_str = txt_bytes.decode("utf-8", errors="ignore").strip().strip('"')
                    found_records.append(txt_str)
                    if expected_value in txt_str or domain.verification_token in txt_str:
                        is_verified = True
                        break
                if is_verified:
                    break
        except Exception:
            continue
        if is_verified:
            break

    # Development fallback for test/mock domains
    is_dev = not os.environ.get("VERCEL") and (os.environ.get("ENVIRONMENT") != "production")
    if not is_verified and is_dev and (
        domain.domain.endswith(".test") 
        or domain.domain.endswith(".example") 
        or domain.domain.endswith("example.com") 
        or domain.domain in ("acme.com", "example.com", "localhost")
    ):
        is_verified = True

    if not is_verified:
        raise HTTPException(
            status_code=400,
            detail=(
                f"DNS TXT record not detected for {domain.domain}. "
                f"Expected TXT record containing '{expected_value}' at '_breachguard-verify.{domain.domain}' or '@'. "
                f"Records found: {found_records if found_records else 'None'}. "
                "Please ensure the DNS TXT record is saved and allow time for DNS cache propagation."
            )
        )

    domain.verified = True
    await db.commit()
    return {"status": "verified", "domain": domain.domain, "message": "Domain ownership successfully verified via DNS."}

@router.patch("/{id}", response_model=DomainResponse)
async def update_domain(
    id: int, 
    domain_update: DomainUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(MonitoredDomain).where(
            MonitoredDomain.id == id, 
            MonitoredDomain.org_id == current_user.org_id
        )
    )
    domain = result.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    domain.scan_frequency = domain_update.scan_frequency
    await db.commit()
    await db.refresh(domain)

    # Compute exposure count
    count_res = await db.execute(
        select(func.count(Exposure.id))
        .join(MonitoredEmail, Exposure.email_id == MonitoredEmail.id)
        .where(MonitoredEmail.domain_id == domain.id)
    )
    resp_obj = DomainResponse.model_validate(domain)
    resp_obj.exposure_count = count_res.scalar() or 0
    return resp_obj

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
    # Verify domain belongs to authenticated user's org (BOLA/IDOR prevention)
    d_res = await db.execute(
        select(MonitoredDomain).where(
            MonitoredDomain.id == id,
            MonitoredDomain.org_id == current_user.org_id
        )
    )
    if not d_res.scalars().first():
        raise HTTPException(status_code=404, detail="Domain not found")

    result = await db.execute(select(ScanJob).where(ScanJob.domain_id == id).order_by(ScanJob.id.desc()))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="No scan job found")
    return job

@router.delete("/{id}")
async def delete_domain(
    id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # BG-SEC-09: Enforce admin-only authorization on destructive domain deletion
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only organization administrators can delete monitored domains."
        )

    result = await db.execute(
        select(MonitoredDomain).where(
            MonitoredDomain.id == id, 
            MonitoredDomain.org_id == current_user.org_id
        )
    )
    domain = result.scalars().first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    domain_name = domain.domain

    # 1. Fetch all emails associated with this domain
    emails_res = await db.execute(
        select(MonitoredEmail).where(MonitoredEmail.domain_id == domain.id)
    )
    emails = emails_res.scalars().all()
    email_ids = [e.id for e in emails]

    # 2. Delete exposures associated with these emails
    if email_ids:
        await db.execute(
            delete(Exposure).where(Exposure.email_id.in_(email_ids))
        )

    # 3. Delete monitored emails
    await db.execute(
        delete(MonitoredEmail).where(MonitoredEmail.domain_id == domain.id)
    )

    # 4. Delete scan jobs
    await db.execute(
        delete(ScanJob).where(ScanJob.domain_id == domain.id)
    )

    # 5. Delete discovered assets associated with this domain
    await db.execute(
        delete(DiscoveredAsset).where(DiscoveredAsset.domain_id == domain.id)
    )

    # 6. Delete findings associated with this domain
    await db.execute(
        delete(Finding).where(Finding.domain_id == domain.id)
    )

    # 7. Delete email security assessments
    await db.execute(
        delete(EmailSecurityAssessment).where(EmailSecurityAssessment.domain_id == domain.id)
    )

    # 8. Delete risk assessments associated with this domain
    await db.execute(
        delete(RiskAssessment).where(RiskAssessment.domain_id == domain.id)
    )

    # 9. Delete domain record itself
    await db.delete(domain)
    await db.commit()

    # 10. Check if any monitored domains remain for this organization
    remaining_res = await db.execute(
        select(func.count(MonitoredDomain.id)).where(MonitoredDomain.org_id == current_user.org_id)
    )
    remaining_count = remaining_res.scalar() or 0

    # If zero domains remain, clean any dangling organization-level records to ensure 100% data consistency
    if remaining_count == 0:
        await db.execute(delete(DiscoveredAsset).where(DiscoveredAsset.org_id == current_user.org_id))
        await db.execute(delete(Finding).where(Finding.org_id == current_user.org_id))
        await db.execute(delete(RiskAssessment).where(RiskAssessment.org_id == current_user.org_id))
        await db.execute(delete(EmailSecurityAssessment).where(EmailSecurityAssessment.org_id == current_user.org_id))
        await db.commit()

    try:
        from routers.risk import invalidate_risk_cache
        invalidate_risk_cache(current_user.org_id)
    except Exception:
        pass

    return {
        "status": "success", 
        "message": f"Domain {domain_name} and all associated monitoring data removed successfully.", 
        "id": id,
        "remaining_domains": remaining_count
    }
