from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

ALLOWED_SCOPES = {
    "read:exposures",
    "write:exposures",
    "read:domains",
    "write:domains",
    "scan:execute",
    "read:reports"
}

class ApiKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=2, max_length=100)
    scopes: List[str] = Field(default=["read:exposures", "read:domains"])
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)

class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    name: str
    key_prefix: str
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime] = None
    revoked: bool
    last_used_at: Optional[datetime] = None

class ApiKeyCreatedResponse(ApiKeyResponse):
    raw_key: str
