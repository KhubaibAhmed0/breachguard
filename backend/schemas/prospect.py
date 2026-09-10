from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, List, Optional, Any

class ProspectScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str = Field(..., min_length=3, max_length=100, description="Target domain or email for threat reconnaissance")

class ProspectScanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str
    total_exposures: int
    breach_count: int
    severity_breakdown: Dict[str, int]
    breach_names: Optional[List[str]] = []
    recent_breach: Optional[str] = None
    target_type: Optional[str] = "domain"
    scan_status: Optional[str] = "completed"
    message: Optional[str] = None
    
    # External Cyber Risk Platform Snapshot fields
    overall_risk_score: Optional[int] = 0
    risk_level: Optional[str] = "LOW RISK"
    discovered_assets_count: Optional[int] = 0
    findings_count: Optional[int] = 0
    email_security_score: Optional[int] = 0
    categories: Optional[Dict[str, int]] = None
    sample_findings: Optional[List[Dict[str, Any]]] = []
    conversion_title: Optional[str] = "Get the complete security assessment"
    conversion_features: Optional[List[str]] = []
