from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class WebhookTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    webhook_url: Optional[str] = Field(None, max_length=2048, description="Target webhook URL for test dispatch")

class IntegrationsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slack_webhook_url: Optional[str] = Field(None, max_length=2048, description="Slack incoming webhook URL")
    siem_webhook_url: Optional[str] = Field(None, max_length=2048, description="SIEM or syslog webhook URL")

class IntegrationsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slack_webhook_url: Optional[str] = None
    siem_webhook_url: Optional[str] = None
    logo_path: Optional[str] = None
    logo_url: Optional[str] = None
    is_msp: bool = False
    plan: str = "essential"
