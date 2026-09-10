from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any

class ExposureUpdate(BaseModel):
    status: str

class ExposureResponse(BaseModel):
    id: int
    email_id: int
    org_id: int
    source_name: str
    source_type: str
    data_classes: List[str]
    severity: str
    credential_type: Optional[str]
    first_seen_at: Optional[datetime]
    detected_at: datetime
    status: str
    email: Optional[str] = None
    upgrade_required: bool = False
    class Config:
        from_attributes = True

class ExposureStats(BaseModel):
    total_exposures: int
    by_severity: dict
    by_source_type: dict
    new_in_last_30_days: int
    risk_score: Optional[int] = 0
