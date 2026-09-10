from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List, Optional, Any, Literal

ExposureStatus = Literal["active", "acknowledged", "resolved", "false_positive", "mitigated"]
SeverityLevel = Literal["critical", "high", "medium", "low"]

class ExposureUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: ExposureStatus = Field(..., description="Target remediation status")

class ExposureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email_id: int
    org_id: int
    source_name: str
    source_type: str
    data_classes: List[str]
    severity: str
    credential_type: Optional[str] = None
    first_seen_at: Optional[datetime] = None
    detected_at: datetime
    status: str
    email: Optional[str] = None
    upgrade_required: bool = False

class ExposureStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_exposures: int
    by_severity: dict
    by_source_type: dict
    new_in_last_30_days: int
    risk_score: Optional[int] = 0
