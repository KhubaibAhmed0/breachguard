from pydantic import BaseModel
from datetime import datetime

from typing import Optional

class ReportGenerate(BaseModel):
    report_type: str
    domain_name: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    org_id: int
    report_type: str
    domain_name: Optional[str] = None
    file_url: str
    generated_at: datetime
    class Config:
        from_attributes = True
