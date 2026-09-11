from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Literal

class DomainCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str = Field(..., min_length=3, max_length=253, description="Fully qualified domain name")
    scan_frequency: Literal["daily", "weekly", "continuous"] = "daily"

class DomainResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    org_id: int
    domain: str
    verified: bool
    verification_token: Optional[str] = None
    scan_frequency: str
    last_scanned_at: Optional[datetime] = None
    created_at: datetime
    exposure_count: Optional[int] = 0

class VerificationRecordResponse(BaseModel):
    domain: str
    record_type: str = "TXT"
    host: str
    value: str
    verified: bool
    instructions: str

class DomainScanStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    new_exposures_found: int
    started_at: datetime
    completed_at: Optional[datetime] = None
