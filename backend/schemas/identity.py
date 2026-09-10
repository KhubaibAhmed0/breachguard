from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime
from typing import List, Optional

class IdentityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain_id: int = Field(..., ge=1, description="Valid domain identifier")
    email: EmailStr = Field(..., max_length=254, description="Monitored corporate identity email")

class IdentityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    domain: str
    domain_id: int
    created_at: datetime

class IdentityListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    identities: List[IdentityItem]
    used_count: int
    quota_limit: int
    plan: str
