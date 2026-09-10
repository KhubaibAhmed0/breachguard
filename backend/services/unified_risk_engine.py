import logging
from typing import Dict, Any, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

def calculate_attack_surface_score(findings: List[Dict[str, Any]], asset_count: int) -> int:
    """
    Computes External Attack Surface posture score (0-100).
    Base 100, deducting for exposed administrative services, pre-production interfaces, and CVEs.
    """
    score = 100.0
    for f in findings:
        if f.get("category") == "attack_surface":
            sev = f.get("severity", "low")
            if sev == "critical":
                score -= 25.0
            elif sev == "high":
                score -= 15.0
            elif sev == "medium":
                score -= 10.0
            elif sev == "low":
                score -= 5.0
    return max(0, min(100, int(score)))

def calculate_threat_intel_score(findings: List[Dict[str, Any]], breach_count: int) -> int:
    """
    Computes Threat Intelligence score (0-100).
    Base 100, deducting for historical breach disclosure density and vendor reputation flags.
    """
    score = 100.0 - (breach_count * 6.0)
    for f in findings:
        if f.get("category") == "threat_intel":
            sev = f.get("severity", "low")
            if sev == "critical":
                score -= 20.0
            elif sev == "high":
                score -= 15.0
            elif sev == "medium":
                score -= 5.0
    return max(0, min(100, int(score)))

def calculate_credential_score(exposures: List[Any]) -> int:
    """
    Computes Credential Exposure score (0-100) from monitored identity exposure records.
    """
    score = 100.0
    for exp in exposures:
        status = getattr(exp, "status", "open")
        sev = getattr(exp, "severity", "low")
        if status == "open":
            if sev == "critical":
                score -= 20.0
            elif sev == "high":
                score -= 12.0
            elif sev == "medium":
                score -= 6.0
            else:
                score -= 2.0
        elif status == "remediated":
            score += 2.0
    return max(0, min(100, int(score)))

def compute_unified_risk(
    attack_surface_findings: List[Dict[str, Any]],
    assets_count: int,
    email_sec_score: int,
    threat_intel_findings: List[Dict[str, Any]],
    breaches_count: int,
    exposures: List[Any]
) -> Dict[str, Any]:
    """
    Computes unified category scores and overall external cyber risk score.
    Methodology:
    - Attack Surface Posture (Weight: 30%)
    - Email Security Posture (Weight: 25%)
    - Public Threat Intelligence (Weight: 20%)
    - Credential Exposure (Weight: 25%)
    """
    as_score = calculate_attack_surface_score(attack_surface_findings, assets_count)
    ti_score = calculate_threat_intel_score(threat_intel_findings, breaches_count)
    cred_score = calculate_credential_score(exposures)

    # Weighted posture score (0-100, where 100 is optimal security)
    posture_score = (
        (as_score * 0.30) +
        (email_sec_score * 0.25) +
        (ti_score * 0.20) +
        (cred_score * 0.25)
    )

    # Invert posture score to obtain External Cyber Risk Score (where 100 is maximum risk)
    overall_risk = int(round(100.0 - posture_score))
    overall_risk = max(5, min(95, overall_risk))  # Realistic bounds

    if overall_risk >= 75:
        risk_level = "CRITICAL RISK"
        risk_color = "#DC2626"
    elif overall_risk >= 60:
        risk_level = "HIGH RISK"
        risk_color = "#EA580C"
    elif overall_risk >= 35:
        risk_level = "MEDIUM RISK"
        risk_color = "#CA8A04"
    else:
        risk_level = "LOW RISK"
        risk_color = "#16A34A"

    return {
        "overall_risk_score": overall_risk,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "categories": {
            "attack_surface": as_score,
            "email_security": email_sec_score,
            "threat_intelligence": ti_score,
            "credential_exposure": cred_score
        }
    }

def deduplicate_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicates findings on (category, asset, title), merging evidence sources.
    """
    merged = {}
    for f in findings:
        key = (f.get("category"), f.get("asset"), f.get("title"))
        if key not in merged:
            merged[key] = dict(f)
        else:
            # Merge sources
            existing = merged[key]
            try:
                import json
                s1 = set(json.loads(existing.get("sources", "[]")))
                s2 = set(json.loads(f.get("sources", "[]")))
                existing["sources"] = json.dumps(list(s1 | s2))
            except Exception:
                pass
    return list(merged.values())
