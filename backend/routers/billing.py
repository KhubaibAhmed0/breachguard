from fastapi import APIRouter, Request
router = APIRouter()

@router.post("/checkout")
async def create_checkout():
    return {"url": "https://checkout.stripe.com/pay/cs_test_mock"}

@router.post("/portal")
async def create_portal():
    return {"url": "https://billing.stripe.com/p/session/test_mock"}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    return {"status": "success"}
