import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from core.ssrf_guard import validate_url_for_ssrf, safe_http_post
from models.user import User
from models.organization import Organization
from schemas.settings import WebhookTestRequest, IntegrationsUpdateRequest, IntegrationsResponse
from routers.deps import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/test-webhook")
async def test_webhook(
    req: Optional[WebhookTestRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dispatches formatted Slack test alert:
    {"text": "🚨 *BreachGuard Security Alert Test*\nYour integration is connected successfully. Real-time exposure alerts will appear here."}
    Protected with SSRF validation, DNS rebinding defense, and redirect restriction.
    """
    target_url = None
    if req and req.webhook_url:
        target_url = req.webhook_url.strip()

    if not target_url:
        org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
        org = org_res.scalars().first()
        target_url = org.slack_webhook_url if org else None

    if not target_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No webhook URL provided or configured in settings."
        )

    payload = {
        "text": "🚨 *BreachGuard Security Alert Test*\nYour integration is connected successfully. Real-time exposure alerts will appear here."
    }

    try:
        resp = await safe_http_post(target_url, json_payload=payload, timeout=10.0)
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Webhook delivery failed with HTTP status {resp.status_code}."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to dispatch test webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook delivery failed due to network connection error."
        )

    return {"status": "success", "message": "Test alert dispatched"}

@router.get("/integrations")
async def get_integrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve current integration webhook URLs, logo path/URL, and MSP status.
    """
    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    logo_url = None
    if org.logo_path and os.path.exists(org.logo_path):
        base_name = os.path.basename(org.logo_path)
        logo_url = f"/uploads/logos/{base_name}"

    return {
        "slack_webhook_url": org.slack_webhook_url or "",
        "siem_webhook_url": org.siem_webhook_url or "",
        "logo_path": org.logo_path or "",
        "logo_url": logo_url or "",
        "is_msp": bool(org.is_msp),
        "plan": org.plan or "essential"
    }

@router.patch("/integrations")
async def update_integrations(
    req: IntegrationsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators can update integrations."
        )

    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if req.slack_webhook_url is not None:
        url = req.slack_webhook_url.strip()
        org.slack_webhook_url = validate_url_for_ssrf(url, resolve_dns=False) if url else None
    if req.siem_webhook_url is not None:
        url = req.siem_webhook_url.strip()
        org.siem_webhook_url = validate_url_for_ssrf(url, resolve_dns=False) if url else None

    await db.commit()
    await db.refresh(org)

    return {
        "status": "success",
        "slack_webhook_url": org.slack_webhook_url,
        "siem_webhook_url": org.siem_webhook_url,
        "message": "Integrations updated successfully"
    }

class OrgUpdateRequest(BaseModel):
    name: str

@router.patch("/organization")
async def update_organization(
    req: OrgUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can change organization details.")
    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Organization name cannot be empty.")
    org.name = clean_name
    await db.commit()
    await db.refresh(org)
    return {"status": "success", "name": org.name, "message": "Organization updated successfully."}

ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_LOGO_MIMES = {"image/png", "image/jpeg", "image/pjpeg", "image/webp"}
MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024  # 2MB

@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload corporate logo for co-branded PDF threat reports (BG-SEC-04).
    Enforces RBAC (admin only), extension whitelisting, magic-byte inspection,
    2MB size limit, active content neutralization, and randomized filenames.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators can upload organization logos."
        )

    # 1. Filename & extension validation
    filename = file.filename or ""
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext not in ALLOWED_LOGO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Only PNG, JPEG, and WEBP image formats are permitted."
        )

    # 2. Content-Type MIME validation
    if file.content_type and file.content_type.lower() not in ALLOWED_LOGO_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid MIME type '{file.content_type}'. Only PNG, JPEG, and WEBP images are allowed."
        )

    # 3. Read content with size bound (2MB max)
    content = await file.read(MAX_LOGO_FILE_SIZE + 1)
    if len(content) > MAX_LOGO_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Logo file size exceeds the maximum allowed limit of 2MB."
        )
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 4. Magic-byte signature verification
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_webp = content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"

    if not (is_png or is_jpeg or is_webp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File signature verification failed. The file is not a valid PNG, JPEG, or WEBP image."
        )

    # 5. Deep inspection against embedded scripts, SVG, or HTML polyglots
    content_lower = content.lower()
    dangerous_signatures = [b"<script", b"<html", b"<svg", b"javascript:", b"onload=", b"onerror=", b"<?php", b"<%"]
    if any(sig in content_lower for sig in dangerous_signatures):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: Active script or markup content detected within uploaded image."
        )

    # 6. Safe server-side randomized filename outside user control
    import secrets
    uploads_dir = os.path.join(os.getcwd(), "uploads", "logos")
    os.makedirs(uploads_dir, exist_ok=True)
    saved_filename = f"logo_{current_user.org_id}_{secrets.token_hex(8)}{ext}"
    file_path = os.path.join(uploads_dir, saved_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # 7. Update organization record
    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    if org:
        org.logo_path = file_path
        await db.commit()
        await db.refresh(org)

    logo_url = f"/uploads/logos/{saved_filename}"

    return {
        "status": "success",
        "message": "Corporate logo uploaded and verified successfully",
        "logo_path": file_path,
        "logo_url": logo_url
    }

@router.delete("/purge-history")
async def purge_history(
    confirm: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    On-demand organization data deletion workflow (Measure 23):
    Allows organization administrators to purge all historical exposure and alert records.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators may execute data deletion workflows."
        )

    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation required. Set query parameter confirm=true to purge historical exposure records."
        )

    from services.retention_service import purge_organization_history
    deleted_count = await purge_organization_history(current_user.org_id, db)

    return {
        "status": "success",
        "message": f"Successfully purged {deleted_count} historical exposure records.",
        "purged_count": deleted_count
    }
