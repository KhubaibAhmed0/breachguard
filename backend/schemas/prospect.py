from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, List, Optional

class ProspectScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str = Field(..., min_length=3, max_length=253, description="Target domain for threat reconnaissance")

class ProspectScanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str
    total_exposures: int
    breach_count: int
    severity_breakdown: Dict[str, int]
    breach_names: Optional[List[str]] = []
    recent_breach: Optional[str] = None
    target_type: Optional[str] = "domain"
