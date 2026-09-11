import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from models.alert import Alert
from typing import List, Any, Optional
from core.config import settings

from sqlalchemy.future import select
from models.user import User
from models.organization import Organization
from services.email_service import send_email, render_breach_alert_email

logger = logging.getLogger(__name__)

async def send_email_alert(org_id: int, new_exposures: List[Any], db: AsyncSession, domain_name: Optional[str] = None):
    """
    Creates Alert records in DB and dispatches HTML breach alert emails to organization administrators.
    """
    logger.info(f"Sending email alert for org {org_id}: {len(new_exposures)} new exposures found.")
    
    for exp in new_exposures:
        alert = Alert(
            org_id=org_id,
            exposure_id=exp.id,
            channel="email"
        )
        db.add(alert)
    
    await db.commit()

    # Query org info and recipient emails
    try:
        org_res = await db.execute(select(Organization).where(Organization.id == org_id))
        org = org_res.scalars().first()
        org_name = org.name if org else f"Organization #{org_id}"

        users_res = await db.execute(
            select(User.email).where(User.org_id == org_id, User.role.in_(["admin", "analyst"]))
        )
        recipient_emails = users_res.scalars().all()

        if recipient_emails and new_exposures:
            target_domain = domain_name or (org.domains[0].domain if org and org.domains else "monitored domain")
            html_body = render_breach_alert_email(
                org_name=org_name,
                domain=target_domain,
                exposure_count=len(new_exposures),
                exposures=new_exposures
            )
            for recipient in recipient_emails:
                await send_email(
                    to_email=recipient,
                    subject=f"🚨 [BreachGuard Alert] {len(new_exposures)} New Exposure(s) Detected for {target_domain}",
                    html_body=html_body,
                    text_body=f"BreachGuard detected {len(new_exposures)} new exposures for {target_domain}. Check your dashboard."
                )
    except Exception as e:
        logger.error(f"Error dispatching breach alert emails for org {org_id}: {e}")

import time
import json
import hmac
import hashlib
import asyncio
from core.ssrf_guard import safe_http_post

def generate_webhook_signature(payload: Any, secret: Optional[str] = None) -> str:
    """
    Computes cryptographic HMAC-SHA256 payload signature with timestamp (Measure 30).
    Format: t={timestamp},v1={hex_digest}
    """
    signing_secret = secret or settings.WEBHOOK_SIGNING_KEY or "bg_isolated_webhook_signing_key_default"
    timestamp = int(time.time())
    if isinstance(payload, dict):
        serialized = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    elif isinstance(payload, bytes):
        try:
            parsed = json.loads(payload.decode("utf-8"))
            serialized = json.dumps(parsed, separators=(',', ':'), sort_keys=True)
        except Exception:
            serialized = payload.decode("utf-8")
    else:
        serialized = str(payload)

    message = f"t={timestamp}.{serialized}"
    sig = hmac.new(signing_secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={sig}"

def verify_webhook_signature(payload: Any, sig_header: str, secret: Optional[str] = None, tolerance_seconds: int = 300) -> bool:
    """
    Cryptographically verifies webhook signature with replay protection.
    """
    signing_secret = secret or settings.WEBHOOK_SIGNING_KEY or "bg_isolated_webhook_signing_key_default"
    if not sig_header or not signing_secret:
        return False
    parts = dict(pair.split("=", 1) for pair in sig_header.split(",") if "=" in pair)
    timestamp_str = parts.get("t")
    v1_sig = parts.get("v1")
    if not timestamp_str or not v1_sig:
        return False
    try:
        ts = int(timestamp_str)
        if abs(time.time() - ts) > tolerance_seconds:
            return False
    except ValueError:
        return False

    if isinstance(payload, dict):
        serialized = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    elif isinstance(payload, bytes):
        try:
            parsed = json.loads(payload.decode("utf-8"))
            serialized = json.dumps(parsed, separators=(',', ':'), sort_keys=True)
        except Exception:
            serialized = payload.decode("utf-8")
    else:
        serialized = str(payload)

    message = f"t={timestamp_str}.{serialized}".encode("utf-8")
    expected_sig = hmac.new(signing_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, v1_sig)

async def send_webhook_alert(webhook_url: str, payload: dict, secret: Optional[str] = None) -> bool:
    """
    POST JSON payload to webhook URL using safe_http_post with:
    - SSRF & DNS rebinding defense
    - HMAC-SHA256 payload signing (replay & tamper protection)
    - Strictly isolated webhook secret (NEVER re-uses JWT master SECRET_KEY)
    - Strict timeout (10s) and bounded retries (max 2)
    - Zero secret logging
    """
    # BG-SEC-03: Strictly separate webhook signing from JWT master SECRET_KEY
    signing_secret = secret or settings.WEBHOOK_SIGNING_KEY or "bg_isolated_webhook_signing_key_default"
    sig_header = generate_webhook_signature(payload, signing_secret)
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "BreachGuard-Webhook/1.0",
        "X-BreachGuard-Signature": sig_header
    }

    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            response = await safe_http_post(
                webhook_url, 
                json_payload=payload, 
                timeout=10.0,
                headers=headers
            )
            if response.status_code < 400:
                logger.info("Webhook alert dispatched and signed successfully.")
                return True
            else:
                logger.warning(f"Webhook alert attempt {attempt} returned HTTP {response.status_code}")
        except Exception as e:
            logger.warning(f"Webhook alert attempt {attempt} network error: {e}")
        
        if attempt < max_retries:
            await asyncio.sleep(1.0 * attempt)

    logger.error("Failed to dispatch webhook alert after maximum retries.")
    return False
