from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List, Optional

class TenantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=2, max_length=100, description="Name of managed tenant organization")

class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    plan: str
    parent_org_id: Optional[int] = None
    domains_count: int = 0
    exposures_count: int = 0
    logo_path: Optional[str] = None
    created_at: datetime

class SwitchTenantResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str
    token_type: str
    tenant: dict
