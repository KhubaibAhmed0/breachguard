from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DomainCreate(BaseModel):
    domain: str
    scan_frequency: str = "daily"

class DomainResponse(BaseModel):
    id: int
    org_id: int
    domain: str
    verified: bool
    scan_frequency: str
    last_scanned_at: Optional[datetime]
    created_at: datetime
    exposure_count: Optional[int] = 0
    class Config:
        from_attributes = True

class DomainScanStatus(BaseModel):
    id: int
    status: str
    new_exposures_found: int
    started_at: datetime
    completed_at: Optional[datetime]
    class Config:
        from_attributes = True
