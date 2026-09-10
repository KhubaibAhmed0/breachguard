import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from models.alert import Alert
from typing import List, Any, Optional
from core.config import settings

logger = logging.getLogger(__name__)

async def send_email_alert(org_id: int, new_exposures: List[Any], db: AsyncSession):
    """
    Log email alert and create Alert records in db.
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

import time
import json
import hmac
import hashlib
import asyncio
from core.ssrf_guard import safe_http_post

def generate_webhook_signature(payload: dict, secret: str) -> str:
    """
    Computes cryptographic HMAC-SHA256 payload signature with timestamp (Measure 30).
    Format: t={timestamp},v1={hex_digest}
    """
    timestamp = int(time.time())
    serialized = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    message = f"t={timestamp}.{serialized}"
    sig = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={sig}"

async def send_webhook_alert(webhook_url: str, payload: dict, secret: Optional[str] = None) -> bool:
    """
    POST JSON payload to webhook URL using safe_http_post with:
    - SSRF & DNS rebinding defense
    - HMAC-SHA256 payload signing (replay & tamper protection)
    - Strict timeout (10s) and bounded retries (max 2)
    - Zero secret logging
    """
    signing_secret = secret or settings.SECRET_KEY
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
