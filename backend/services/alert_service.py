import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from models.alert import Alert
from typing import List, Any
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

from core.ssrf_guard import safe_http_post

async def send_webhook_alert(webhook_url: str, payload: dict):
    """
    POST JSON payload to webhook URL using safe_http_post with SSRF and DNS rebinding defense.
    """
    try:
        response = await safe_http_post(webhook_url, json_payload=payload, timeout=10.0)
        if response.status_code >= 400:
            logger.warning(f"Webhook alert failed with HTTP status {response.status_code}")
        else:
            logger.info("Webhook alert dispatched successfully.")
    except Exception as e:
        logger.error(f"Failed to dispatch webhook alert safely: {e}")
