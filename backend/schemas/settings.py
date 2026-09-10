from pydantic import BaseModel
from typing import Optional

class WebhookTestRequest(BaseModel):
    webhook_url: Optional[str] = None

class IntegrationsUpdateRequest(BaseModel):
    slack_webhook_url: Optional[str] = None
    siem_webhook_url: Optional[str] = None

class IntegrationsResponse(BaseModel):
    slack_webhook_url: Optional[str] = None
    siem_webhook_url: Optional[str] = None
    logo_path: Optional[str] = None
    logo_url: Optional[str] = None
    is_msp: bool = False
    plan: str = "essential"
