from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from typing import Optional, Literal, Any

class ReportGenerate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    report_type: str = "executive"
    domain_name: Optional[str] = Field(None, max_length=253)

    @field_validator("report_type", mode="before")
    @classmethod
    def normalize_report_type(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip().lower()
            if val in ["executive", "technical", "full", "compliance"]:
                return val
        return "executive"

class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    org_id: int
    report_type: str
    domain_name: Optional[str] = None
    file_url: str
    generated_at: datetime
