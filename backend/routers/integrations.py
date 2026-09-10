import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from models.user import User
from models.organization import Organization
from routers.deps import get_current_user

router = APIRouter()

class TestWebhookRequest(BaseModel):
    webhook_url: Optional[str] = None

class IntegrationsUpdateRequest(BaseModel):
    slack_webhook_url: Optional[str] = None
    siem_webhook_url: Optional[str] = None

@router.post("/test-webhook")
async def test_webhook(
    req: TestWebhookRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dispatches formatted Slack test alert:
    {"text": "🚨 *BreachGuard Security Alert Test*\nYour integration is connected successfully. Real-time exposure alerts will appear here."}
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(target_url, json=payload)
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Webhook delivery failed with HTTP {resp.status_code}: {resp.text[:200]}"
                )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook delivery failed due to network error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to dispatch test alert: {str(e)}"
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
    """
    Update Slack and SIEM webhook integration URLs for current user's organization.
    """
    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if req.slack_webhook_url is not None:
        org.slack_webhook_url = req.slack_webhook_url.strip() if req.slack_webhook_url.strip() else None
    if req.siem_webhook_url is not None:
        org.siem_webhook_url = req.siem_webhook_url.strip() if req.siem_webhook_url.strip() else None

    await db.commit()
    await db.refresh(org)

    return {
        "status": "success",
        "slack_webhook_url": org.slack_webhook_url,
        "siem_webhook_url": org.siem_webhook_url,
        "message": "Integrations updated successfully"
    }

@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload corporate logo for co-branded PDF threat reports.
    Ensures uploads folder exists (uploads/logos/).
    Saves file as uploads/logos/{org_id}_{file.filename}.
    Updates org.logo_path.
    """
    uploads_dir = os.path.join(os.getcwd(), "uploads", "logos")
    os.makedirs(uploads_dir, exist_ok=True)

    clean_filename = os.path.basename(file.filename).replace(" ", "_")
    saved_filename = f"{current_user.org_id}_{clean_filename}"
    file_path = os.path.join(uploads_dir, saved_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    if org:
        org.logo_path = file_path
        await db.commit()
        await db.refresh(org)

    logo_url = f"/uploads/logos/{saved_filename}"

    return {
        "status": "success",
        "message": "Corporate logo uploaded successfully",
        "logo_path": file_path,
        "logo_url": logo_url
    }
