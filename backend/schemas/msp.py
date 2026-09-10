from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class TenantCreate(BaseModel):
    name: str

class TenantResponse(BaseModel):
    id: int
    name: str
    plan: str
    parent_org_id: Optional[int] = None
    domains_count: int = 0
    exposures_count: int = 0
    logo_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SwitchTenantResponse(BaseModel):
    access_token: str
    token_type: str
    tenant: dict
