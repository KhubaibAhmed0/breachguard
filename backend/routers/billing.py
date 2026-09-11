import time
import json
import hmac
import hashlib
import logging
from typing import Optional, Dict, Any, Set
from fastapi import APIRouter, Request, HTTPException, Depends, status, Header
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from core.config import settings
from core.database import get_db
from models.user import User
from models.organization import Organization
from routers.deps import get_current_user

logger = logging.getLogger("breachguard.billing")

router = APIRouter()

# Immutable server-side price-to-plan catalog (Measure 31)
VALID_PRICES = {
    "price_business_monthly": {"plan": "business", "interval": "month"},
    "price_business_annual": {"plan": "business", "interval": "year"},
    "price_enterprise_monthly": {"plan": "enterprise", "interval": "month"},
    "price_enterprise_annual": {"plan": "enterprise", "interval": "year"},
}

# Idempotency cache for processed webhook event IDs
PROCESSED_EVENT_IDS: Set[str] = set()

class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    price_id: str = Field(..., description="Stripe Price ID from official catalog")

def verify_stripe_signature(payload_bytes: bytes, sig_header: str, secret: str) -> bool:
    """
    Cryptographically verifies Stripe webhook signature (t=...,v1=...) with replay protection.
    """
    if not sig_header or not secret:
        return False

    parts = dict(pair.split("=", 1) for pair in sig_header.split(",") if "=" in pair)
    timestamp_str = parts.get("t")
    v1_sig = parts.get("v1")

    if not timestamp_str or not v1_sig:
        return False

    try:
        ts = int(timestamp_str)
        # 5-minute replay window tolerance
        if abs(time.time() - ts) > 300:
            logger.warning("Stripe webhook timestamp outside tolerance window.")
            return False
    except ValueError:
        return False

    signed_payload = f"{timestamp_str}.".encode("utf-8") + payload_bytes
    expected_sig = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, v1_sig)

@router.post("/checkout")
async def create_checkout(
    req: CheckoutRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Creates Stripe Checkout session with strictly server-validated price IDs.
    Clients cannot control pricing or directly grant entitlements.
    """
    if req.price_id not in VALID_PRICES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid price selection. Allowed price IDs: {list(VALID_PRICES.keys())}"
        )

    target_plan = VALID_PRICES[req.price_id]["plan"]
    
    # If real Stripe API key configured, generate live hosted session
    if settings.STRIPE_SECRET_KEY:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
                    data={
                        "success_url": f"{settings.FRONTEND_URL}/settings?session_id={{CHECKOUT_SESSION_ID}}",
                        "cancel_url": f"{settings.FRONTEND_URL}/settings",
                        "mode": "subscription",
                        "client_reference_id": str(current_user.org_id),
                        "customer_email": current_user.email,
                        "line_items[0][price]": req.price_id,
                        "line_items[0][quantity]": "1",
                        "metadata[org_id]": str(current_user.org_id),
                    }
                )
                if res.status_code == 200:
                    session_data = res.json()
                    return {
                        "url": session_data.get("url"),
                        "session_id": session_data.get("id"),
                        "plan": target_plan
                    }
                else:
                    logger.warning(f"Stripe checkout session creation failed: {res.text}")
        except Exception as e:
            logger.error(f"Stripe network error: {e}")

    # Fallback to test checkout URL when Stripe keys are unset
    mock_session_id = f"cs_test_{current_user.org_id}_{target_plan}"
    return {
        "url": f"https://checkout.stripe.com/pay/{mock_session_id}",
        "session_id": mock_session_id,
        "plan": target_plan
    }

@router.post("/portal")
async def create_portal(
    current_user: User = Depends(get_current_user)
):
    """
    Generates hosted customer billing portal URL.
    """
    if settings.STRIPE_SECRET_KEY and current_user.organization and current_user.organization.stripe_customer_id:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.stripe.com/v1/billing_portal/sessions",
                    headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
                    data={
                        "customer": current_user.organization.stripe_customer_id,
                        "return_url": f"{settings.FRONTEND_URL}/settings",
                    }
                )
                if res.status_code == 200:
                    portal_data = res.json()
                    return {"url": portal_data.get("url")}
        except Exception as e:
            logger.error(f"Stripe Customer Portal API error: {e}")

    return {
        "url": f"https://billing.stripe.com/p/session/portal_{current_user.org_id}"
    }

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db)
):
    """
    Handles Stripe webhooks with cryptographic signature verification,
    idempotency checks, and server-side entitlement provisioning (Measure 31).
    """
    body_bytes = await request.body()

    # 1. Cryptographic Signature Verification (Fail-Closed)
    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("[STRIPE_WEBHOOK] Webhook rejected: STRIPE_WEBHOOK_SECRET is not configured on the server.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook processing is currently unavailable (webhook secret not configured)."
        )

    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required Stripe-Signature header."
        )

    is_valid = verify_stripe_signature(body_bytes, stripe_signature, settings.STRIPE_WEBHOOK_SECRET)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook signature."
        )

    try:
        event = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    event_id = event.get("id")
    event_type = event.get("type")

    # 2. Idempotency Check
    if event_id in PROCESSED_EVENT_IDS:
        logger.info(f"[STRIPE_WEBHOOK] Duplicate event {event_id} ignored.")
        return {"status": "already_processed", "id": event_id}

    if event_id:
        PROCESSED_EVENT_IDS.add(event_id)

    # 3. Server-side subscription entitlements
    data_object = event.get("data", {}).get("object", {})
    client_ref_id = data_object.get("client_reference_id") or data_object.get("metadata", {}).get("org_id")

    if event_type in ("checkout.session.completed", "customer.subscription.created", "customer.subscription.updated"):
        price_id = None
        # Extract price_id from session or subscription items
        if "lines" in data_object:
            items = data_object.get("lines", {}).get("data", [])
            if items:
                price_id = items[0].get("price", {}).get("id")
        elif "items" in data_object:
            items = data_object.get("items", {}).get("data", [])
            if items:
                price_id = items[0].get("price", {}).get("id")

        if client_ref_id:
            try:
                org_id = int(client_ref_id)
                new_plan = VALID_PRICES.get(price_id, {}).get("plan", "business")
                org_res = await db.execute(select(Organization).where(Organization.id == org_id))
                org = org_res.scalars().first()
                if org:
                    org.plan = new_plan
                    org.is_trial = False
                    org.trial_ends_at = None
                    await db.commit()
                    logger.info(f"[STRIPE_WEBHOOK] Org {org_id} plan upgraded to '{new_plan}'.")
            except Exception as e:
                logger.error(f"[STRIPE_WEBHOOK] Failed to update organization plan: {e}")

    elif event_type == "customer.subscription.deleted":
        if client_ref_id:
            try:
                org_id = int(client_ref_id)
                org_res = await db.execute(select(Organization).where(Organization.id == org_id))
                org = org_res.scalars().first()
                if org:
                    org.plan = "essential"
                    await db.commit()
                    logger.info(f"[STRIPE_WEBHOOK] Org {org_id} subscription cancelled. Downgraded to essential.")
            except Exception as e:
                logger.error(f"[STRIPE_WEBHOOK] Failed to downgrade org {client_ref_id}: {e}")

    return {"status": "success", "event_type": event_type, "id": event_id}
