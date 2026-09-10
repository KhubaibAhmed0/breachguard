from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class IdentityCreate(BaseModel):
    domain_id: int
    email: str

class IdentityItem(BaseModel):
    id: int
    email: str
    domain: str
    domain_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class IdentityListResponse(BaseModel):
    identities: List[IdentityItem]
    used_count: int
    quota_limit: int
    plan: str
