import re
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete, update

from core.database import get_db, Base, engine
from core.config import settings
from routers.deps import get_current_user
from models.user import User
from models.growth import OutreachLead, SocialPost
from services.growth_service import (
    run_passive_reconnaissance,
    generate_cold_email_copy,
    render_outreach_html,
    enforce_rate_throttle,
    RateThrottleException,
    DEFAULT_SOCIAL_POSTS
)
from services.email_service import send_email

logger = logging.getLogger("breachguard.growth.router")

router = APIRouter()

# Role Check Helper
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Founder Growth Hub requires platform administrator privileges."
        )
    return current_user

# ==============================================================================
# Pydantic Schemas
# ==============================================================================

class LeadCreate(BaseModel):
    company_name: str
    domain: str
    contact_email: str
    contact_name: Optional[str] = None
    email_angle: Optional[str] = "dmarc_spoofing"
    auto_scan: Optional[bool] = True

class BulkLeadItem(BaseModel):
    company_name: str
    domain: str
    contact_email: str
    contact_name: Optional[str] = None

class BulkLeadCreate(BaseModel):
    leads: List[BulkLeadItem]
    auto_scan: Optional[bool] = False

class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    email_angle: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    status: Optional[str] = None

class SocialPostCreate(BaseModel):
    platform: str
    category: str
    title: str
    content: str
    hook: Optional[str] = None
    call_to_action: Optional[str] = None
    target_subreddit: Optional[str] = None
    cadence_day: Optional[int] = 1

class SocialPostUpdate(BaseModel):
    platform: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    hook: Optional[str] = None
    call_to_action: Optional[str] = None
    target_subreddit: Optional[str] = None
    status: Optional[str] = None
    scheduled_for: Optional[datetime] = None

# Ensure tables exist
async def ensure_growth_tables():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.debug(f"Growth tables verification notice: {e}")

# ==============================================================================
# Stats Overview
# ==============================================================================

@router.get("/stats")
async def get_growth_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()

    total_leads_res = await db.execute(select(func.count(OutreachLead.id)))
    total_leads = total_leads_res.scalar() or 0

    scanned_leads_res = await db.execute(
        select(func.count(OutreachLead.id)).where(OutreachLead.status.in_(["scanned", "ready", "sent"]))
    )
    scanned_leads = scanned_leads_res.scalar() or 0

    ready_leads_res = await db.execute(
        select(func.count(OutreachLead.id)).where(OutreachLead.status == "ready")
    )
    ready_leads = ready_leads_res.scalar() or 0

    sent_leads_res = await db.execute(
        select(func.count(OutreachLead.id)).where(OutreachLead.status == "sent")
    )
    sent_leads = sent_leads_res.scalar() or 0

    avg_risk_res = await db.execute(
        select(func.avg(OutreachLead.risk_score)).where(OutreachLead.risk_score.isnot(None))
    )
    avg_risk = round(avg_risk_res.scalar() or 0, 1)

    total_posts_res = await db.execute(select(func.count(SocialPost.id)))
    total_posts = total_posts_res.scalar() or 0

    published_posts_res = await db.execute(
        select(func.count(SocialPost.id)).where(SocialPost.status == "published")
    )
    published_posts = published_posts_res.scalar() or 0

    return {
        "total_leads": total_leads,
        "scanned_leads": scanned_leads,
        "ready_leads": ready_leads,
        "sent_leads": sent_leads,
        "average_risk_score": avg_risk,
        "total_social_posts": total_posts,
        "published_social_posts": published_posts,
    }

# ==============================================================================
# Outreach Leads Endpoints
# ==============================================================================

@router.get("/leads")
async def list_outreach_leads(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    query = select(OutreachLead).order_by(OutreachLead.id.desc())
    if status_filter and status_filter != "all":
        query = query.where(OutreachLead.status == status_filter)
    
    result = await db.execute(query)
    leads = result.scalars().all()
    
    output = []
    for l in leads:
        ports = []
        if l.exposed_ports:
            try:
                ports = json.loads(l.exposed_ports)
            except Exception:
                ports = []
        
        sources = []
        if l.breach_sources:
            try:
                sources = json.loads(l.breach_sources)
            except Exception:
                sources = []

        findings = []
        if l.top_findings:
            try:
                findings = json.loads(l.top_findings)
            except Exception:
                findings = []

        output.append({
            "id": l.id,
            "company_name": l.company_name,
            "domain": l.domain,
            "contact_email": l.contact_email,
            "contact_name": l.contact_name,
            "status": l.status,
            "risk_score": l.risk_score,
            "risk_level": l.risk_level,
            "dmarc_status": l.dmarc_status,
            "dmarc_record": l.dmarc_record,
            "exposed_ports": ports,
            "subdomains_count": l.subdomains_count,
            "breach_count": l.breach_count,
            "breach_sources": sources,
            "top_findings": findings,
            "email_angle": l.email_angle,
            "email_subject": l.email_subject,
            "email_body": l.email_body,
            "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })
    return output


@router.post("/leads")
async def create_outreach_lead(
    lead_in: LeadCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()

    clean_domain = lead_in.domain.strip().lower()
    clean_domain = re.sub(r"^https?://", "", clean_domain).split("/")[0].split(":")[0]
    
    lead = OutreachLead(
        company_name=lead_in.company_name.strip(),
        domain=clean_domain,
        contact_email=lead_in.contact_email.strip().lower(),
        contact_name=lead_in.contact_name.strip() if lead_in.contact_name else None,
        email_angle=lead_in.email_angle or "dmarc_spoofing",
        status="pending_scan"
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    if lead_in.auto_scan:
        try:
            recon = await run_passive_reconnaissance(clean_domain)
            lead.risk_score = recon["risk_score"]
            lead.risk_level = recon["risk_level"]
            lead.dmarc_status = recon["dmarc_status"]
            lead.dmarc_record = recon["dmarc_record"]
            lead.exposed_ports = json.dumps(recon["exposed_ports"])
            lead.subdomains_count = recon["subdomains_count"]
            lead.breach_count = recon["breach_count"]
            lead.breach_sources = json.dumps(recon["breach_sources"])
            lead.top_findings = json.dumps(recon["top_findings"])

            lead_dict = {
                "company_name": lead.company_name,
                "domain": lead.domain,
                "contact_name": lead.contact_name,
                "dmarc_status": lead.dmarc_status,
                "exposed_ports": recon["exposed_ports"],
                "breach_count": lead.breach_count,
                "subdomains_count": lead.subdomains_count,
                "risk_score": lead.risk_score
            }
            subject, body = generate_cold_email_copy(lead_dict, angle=lead.email_angle)
            lead.email_subject = subject
            lead.email_body = body
            lead.status = "ready"
            await db.commit()
            await db.refresh(lead)
        except Exception as e:
            logger.error(f"Auto-scan failed for lead {lead.id} ({clean_domain}): {e}")
            lead.status = "failed"
            lead.error_message = str(e)
            await db.commit()

    return {"id": lead.id, "status": lead.status, "message": "Lead created successfully"}


@router.post("/leads/bulk")
async def bulk_create_leads(
    payload: BulkLeadCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    added_count = 0
    created_leads = []

    for item in payload.leads:
        clean_domain = item.domain.strip().lower()
        clean_domain = re.sub(r"^https?://", "", clean_domain).split("/")[0].split(":")[0]
        if not clean_domain or not item.contact_email:
            continue

        lead = OutreachLead(
            company_name=item.company_name.strip(),
            domain=clean_domain,
            contact_email=item.contact_email.strip().lower(),
            contact_name=item.contact_name.strip() if item.contact_name else None,
            email_angle="dmarc_spoofing",
            status="pending_scan"
        )
        db.add(lead)
        created_leads.append(lead)
        added_count += 1

    await db.commit()

    if payload.auto_scan:
        for lead in created_leads:
            try:
                await db.refresh(lead)
                recon = await run_passive_reconnaissance(lead.domain)
                lead.risk_score = recon["risk_score"]
                lead.risk_level = recon["risk_level"]
                lead.dmarc_status = recon["dmarc_status"]
                lead.dmarc_record = recon["dmarc_record"]
                lead.exposed_ports = json.dumps(recon["exposed_ports"])
                lead.subdomains_count = recon["subdomains_count"]
                lead.breach_count = recon["breach_count"]
                lead.breach_sources = json.dumps(recon["breach_sources"])
                lead.top_findings = json.dumps(recon["top_findings"])

                lead_dict = {
                    "company_name": lead.company_name,
                    "domain": lead.domain,
                    "contact_name": lead.contact_name,
                    "dmarc_status": lead.dmarc_status,
                    "exposed_ports": recon["exposed_ports"],
                    "breach_count": lead.breach_count,
                    "subdomains_count": lead.subdomains_count,
                    "risk_score": lead.risk_score
                }
                subject, body = generate_cold_email_copy(lead_dict, angle=lead.email_angle)
                lead.email_subject = subject
                lead.email_body = body
                lead.status = "ready"
                await db.commit()
            except Exception as e:
                logger.error(f"Bulk scan failed for lead {lead.id}: {e}")

    return {"status": "success", "imported_count": added_count}


@router.post("/leads/{lead_id}/scan")
async def scan_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    result = await db.execute(select(OutreachLead).where(OutreachLead.id == lead_id))
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    try:
        recon = await run_passive_reconnaissance(lead.domain)
        lead.risk_score = recon["risk_score"]
        lead.risk_level = recon["risk_level"]
        lead.dmarc_status = recon["dmarc_status"]
        lead.dmarc_record = recon["dmarc_record"]
        lead.exposed_ports = json.dumps(recon["exposed_ports"])
        lead.subdomains_count = recon["subdomains_count"]
        lead.breach_count = recon["breach_count"]
        lead.breach_sources = json.dumps(recon["breach_sources"])
        lead.top_findings = json.dumps(recon["top_findings"])

        lead_dict = {
            "company_name": lead.company_name,
            "domain": lead.domain,
            "contact_name": lead.contact_name,
            "dmarc_status": lead.dmarc_status,
            "exposed_ports": recon["exposed_ports"],
            "breach_count": lead.breach_count,
            "subdomains_count": lead.subdomains_count,
            "risk_score": lead.risk_score
        }
        subject, body = generate_cold_email_copy(lead_dict, angle=lead.email_angle or "dmarc_spoofing")
        lead.email_subject = subject
        lead.email_body = body
        lead.status = "ready"
        await db.commit()
        await db.refresh(lead)
        return {
            "status": "success", 
            "message": "Scan completed and email generated", 
            "risk_score": lead.risk_score,
            "subject": lead.email_subject,
            "body": lead.email_body
        }
    except Exception as e:
        logger.error(f"Scan error for lead {lead_id}: {e}")
        lead.status = "failed"
        lead.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Reconnaissance error: {str(e)}")


@router.post("/leads/scan-all")
async def scan_all_pending_leads(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    result = await db.execute(
        select(OutreachLead).where(OutreachLead.status.in_(["pending_scan", "failed"]))
    )
    leads = result.scalars().all()
    scanned_count = 0

    for lead in leads:
        try:
            recon = await run_passive_reconnaissance(lead.domain)
            lead.risk_score = recon["risk_score"]
            lead.risk_level = recon["risk_level"]
            lead.dmarc_status = recon["dmarc_status"]
            lead.dmarc_record = recon["dmarc_record"]
            lead.exposed_ports = json.dumps(recon["exposed_ports"])
            lead.subdomains_count = recon["subdomains_count"]
            lead.breach_count = recon["breach_count"]
            lead.breach_sources = json.dumps(recon["breach_sources"])
            lead.top_findings = json.dumps(recon["top_findings"])

            lead_dict = {
                "company_name": lead.company_name,
                "domain": lead.domain,
                "contact_name": lead.contact_name,
                "dmarc_status": lead.dmarc_status,
                "exposed_ports": recon["exposed_ports"],
                "breach_count": lead.breach_count,
                "subdomains_count": lead.subdomains_count,
                "risk_score": lead.risk_score
            }
            subject, body = generate_cold_email_copy(lead_dict, angle=lead.email_angle or "dmarc_spoofing")
            lead.email_subject = subject
            lead.email_body = body
            lead.status = "ready"
            scanned_count += 1
            await db.commit()
        except Exception as e:
            logger.warning(f"Batch scan failed on {lead.domain}: {e}")

    return {"status": "success", "scanned_count": scanned_count}


@router.put("/leads/{lead_id}")
async def update_lead(
    lead_id: int,
    patch: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    result = await db.execute(select(OutreachLead).where(OutreachLead.id == lead_id))
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if patch.company_name is not None:
        lead.company_name = patch.company_name
    if patch.contact_email is not None:
        lead.contact_email = patch.contact_email
    if patch.contact_name is not None:
        lead.contact_name = patch.contact_name
    if patch.status is not None:
        lead.status = patch.status

    angle_changed = patch.email_angle is not None and patch.email_angle != lead.email_angle
    if patch.email_angle is not None:
        lead.email_angle = patch.email_angle

    if patch.email_subject is not None:
        lead.email_subject = patch.email_subject
    if patch.email_body is not None:
        lead.email_body = patch.email_body

    # If angle changed but custom body was not explicitly provided, regenerate copy
    if angle_changed and patch.email_body is None:
        ports = []
        if lead.exposed_ports:
            try:
                ports = json.loads(lead.exposed_ports)
            except Exception:
                ports = []
        lead_dict = {
            "company_name": lead.company_name,
            "domain": lead.domain,
            "contact_name": lead.contact_name,
            "dmarc_status": lead.dmarc_status or "missing",
            "exposed_ports": ports,
            "breach_count": lead.breach_count or 0,
            "subdomains_count": lead.subdomains_count or 0,
            "risk_score": lead.risk_score or 60
        }
        subj, body = generate_cold_email_copy(lead_dict, angle=lead.email_angle)
        lead.email_subject = subj
        lead.email_body = body

    await db.commit()
    await db.refresh(lead)
    return {"status": "success", "lead_id": lead.id, "subject": lead.email_subject, "body": lead.email_body}


@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    result = await db.execute(select(OutreachLead).where(OutreachLead.id == lead_id))
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await db.delete(lead)
    await db.commit()
    return {"status": "success", "message": "Lead deleted successfully"}


@router.post("/leads/{lead_id}/send")
async def send_lead_email(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    1-Click Send: Sends the personalized outreach email via Resend with rate throttling.
    """
    await ensure_growth_tables()
    result = await db.execute(select(OutreachLead).where(OutreachLead.id == lead_id))
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if not lead.email_subject or not lead.email_body:
        raise HTTPException(status_code=400, detail="Lead does not have a generated email draft yet. Please run scan first.")

    # 1. Enforce rate throttle
    try:
        await enforce_rate_throttle()
    except RateThrottleException as r_err:
        raise HTTPException(status_code=429, detail=str(r_err))

    # 2. Render responsive HTML email
    lead_dict = {
        "company_name": lead.company_name,
        "domain": lead.domain,
        "risk_score": lead.risk_score or 60
    }
    html_content = render_outreach_html(lead_dict, lead.email_subject, lead.email_body)

    # 3. Dispatch via Resend / SMTP
    success = await send_email(
        to_email=lead.contact_email,
        subject=lead.email_subject,
        html_body=html_content,
        text_body=lead.email_body
    )

    if success:
        lead.status = "sent"
        lead.sent_at = datetime.utcnow()
        lead.delivery_status = "delivered"
        lead.error_message = None
        await db.commit()
        return {"status": "success", "message": f"Email successfully dispatched to {lead.contact_email}"}
    else:
        lead.delivery_status = "failed"
        lead.error_message = "Resend / SMTP dispatch encountered an error."
        await db.commit()
        raise HTTPException(status_code=502, detail="Failed to dispatch email via Resend integration.")


@router.post("/leads/send-batch")
async def send_batch_ready_leads(
    max_count: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Throttled batch send of ready outreach leads.
    Paces dispatches safely to protect sender IP and domain reputation.
    """
    await ensure_growth_tables()
    result = await db.execute(
        select(OutreachLead).where(OutreachLead.status == "ready").limit(max_count)
    )
    leads = result.scalars().all()
    if not leads:
        return {"status": "empty", "message": "No leads in 'ready' status to send."}

    sent_count = 0
    failed_count = 0

    for lead in leads:
        try:
            await enforce_rate_throttle()
            lead_dict = {
                "company_name": lead.company_name,
                "domain": lead.domain,
                "risk_score": lead.risk_score or 60
            }
            html_content = render_outreach_html(lead_dict, lead.email_subject, lead.email_body)
            success = await send_email(
                to_email=lead.contact_email,
                subject=lead.email_subject,
                html_body=html_content,
                text_body=lead.email_body
            )
            if success:
                lead.status = "sent"
                lead.sent_at = datetime.utcnow()
                lead.delivery_status = "delivered"
                sent_count += 1
            else:
                lead.delivery_status = "failed"
                failed_count += 1
            await db.commit()
        except Exception as e:
            logger.error(f"Batch dispatch error on lead {lead.id}: {e}")
            failed_count += 1

    return {
        "status": "success",
        "attempted": len(leads),
        "sent_count": sent_count,
        "failed_count": failed_count
    }


# ==============================================================================
# Social Media Autopilot Endpoints
# ==============================================================================

@router.get("/social")
async def list_social_posts(
    platform: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()

    # Auto-seed if empty
    count_res = await db.execute(select(func.count(SocialPost.id)))
    if (count_res.scalar() or 0) == 0:
        await seed_social_posts_internal(db)

    query = select(SocialPost).order_by(SocialPost.cadence_day.asc(), SocialPost.id.asc())
    if platform and platform != "all":
        query = query.where(SocialPost.platform.in_([platform, "both"]))

    result = await db.execute(query)
    posts = result.scalars().all()

    now = datetime.utcnow()
    output = []
    for p in posts:
        # Calculate next scheduled execution date based on cadence_day (every 3 days)
        drop_date = p.scheduled_for or (now + timedelta(days=p.cadence_day - 1))
        output.append({
            "id": p.id,
            "platform": p.platform,
            "category": p.category,
            "title": p.title,
            "hook": p.hook,
            "content": p.content,
            "call_to_action": p.call_to_action,
            "target_subreddit": p.target_subreddit,
            "cadence_day": p.cadence_day,
            "scheduled_for": drop_date.isoformat(),
            "status": p.status,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return output


async def seed_social_posts_internal(db: AsyncSession):
    now = datetime.utcnow()
    for idx, item in enumerate(DEFAULT_SOCIAL_POSTS):
        cadence = item.get("cadence_day", (idx * 3) + 1)
        post = SocialPost(
            platform=item["platform"],
            category=item["category"],
            cadence_day=cadence,
            title=item["title"],
            hook=item.get("hook"),
            content=item["content"],
            call_to_action=item.get("call_to_action"),
            target_subreddit=item.get("target_subreddit"),
            scheduled_for=now + timedelta(days=cadence - 1),
            status="scheduled"
        )
        db.add(post)
    await db.commit()


@router.post("/social/seed")
async def seed_social_posts(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    await seed_social_posts_internal(db)
    return {"status": "success", "message": "Social media content queue seeded with 3-day cadence posts."}


@router.post("/social")
async def create_social_post(
    post_in: SocialPostCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    now = datetime.utcnow()
    cadence = post_in.cadence_day or 1
    post = SocialPost(
        platform=post_in.platform,
        category=post_in.category,
        title=post_in.title,
        content=post_in.content,
        hook=post_in.hook,
        call_to_action=post_in.call_to_action,
        target_subreddit=post_in.target_subreddit,
        cadence_day=cadence,
        scheduled_for=now + timedelta(days=cadence - 1),
        status="scheduled"
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return {"status": "success", "id": post.id}


@router.put("/social/{post_id}")
async def update_social_post(
    post_id: int,
    patch: SocialPostUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if patch.platform is not None:
        post.platform = patch.platform
    if patch.category is not None:
        post.category = patch.category
    if patch.title is not None:
        post.title = patch.title
    if patch.content is not None:
        post.content = patch.content
    if patch.hook is not None:
        post.hook = patch.hook
    if patch.call_to_action is not None:
        post.call_to_action = patch.call_to_action
    if patch.target_subreddit is not None:
        post.target_subreddit = patch.target_subreddit
    if patch.status is not None:
        post.status = patch.status
        if patch.status == "published" and not post.published_at:
            post.published_at = datetime.utcnow()
    if patch.scheduled_for is not None:
        post.scheduled_for = patch.scheduled_for

    await db.commit()
    await db.refresh(post)
    return {"status": "success", "id": post.id, "post_status": post.status}


@router.delete("/social/{post_id}")
async def delete_social_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    await ensure_growth_tables()
    result = await db.execute(select(SocialPost).where(SocialPost.id == post_id))
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.delete(post)
    await db.commit()
    return {"status": "success", "message": "Social post deleted"}
