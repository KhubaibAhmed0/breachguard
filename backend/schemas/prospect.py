from pydantic import BaseModel
from typing import Dict, List, Optional

class ProspectScanRequest(BaseModel):
    domain: str

class ProspectScanResponse(BaseModel):
    domain: str
    total_exposures: int
    breach_count: int
    severity_breakdown: Dict[str, int]
    breach_names: Optional[List[str]] = []
    recent_breach: Optional[str] = None
    target_type: Optional[str] = "domain"
