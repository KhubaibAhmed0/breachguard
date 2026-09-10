from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Literal

class ReportGenerate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    report_type: Literal["executive", "technical", "full", "compliance"] = "executive"
    domain_name: Optional[str] = Field(None, max_length=253)

class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    org_id: int
    report_type: str
    domain_name: Optional[str] = None
    file_url: str
    generated_at: datetime
