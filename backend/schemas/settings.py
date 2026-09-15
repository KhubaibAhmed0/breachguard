from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class WebhookTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    webhook_url: Optional[str] = Field(None, max_length=2048, description="Target webhook URL for test dispatch")

class IntegrationsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slack_webhook_url: Optional[str] = Field(None, max_length=2048, description="Slack incoming webhook URL")
    siem_webhook_url: Optional[str] = Field(None, max_length=2048, description="SIEM or syslog webhook URL")
    accent_color: Optional[str] = Field(None, max_length=50, description="Hex color for white labeling")
    show_prepared_by: Optional[bool] = Field(None, description="Toggle for prepared by text on reports")

class IntegrationsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slack_webhook_url: Optional[str] = None
    siem_webhook_url: Optional[str] = None
    logo_path: Optional[str] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = "#10b981"
    show_prepared_by: bool = True
    is_msp: bool = False
    plan: str = "essential"
