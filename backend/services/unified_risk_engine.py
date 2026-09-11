import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

def calculate_attack_surface_breakdown(findings: List[Dict[str, Any]], asset_count: int) -> Dict[str, Any]:
    """
    Computes External Attack Surface posture score (0-100) and itemized evidence breakdown.
    Base 100, deducting for exposed administrative services, pre-production interfaces, and CVEs.
    """
    base_score = 100.0
    deductions = []
    
    for f in findings:
        if f.get("category") == "attack_surface":
            sev = f.get("severity", "low")
            points = 5.0
            if sev == "critical":
                points = 25.0
            elif sev == "high":
                points = 15.0
            elif sev == "medium":
                points = 10.0
            elif sev == "low":
                points = 5.0
                
            deductions.append({
                "finding_id": f.get("finding_id", "BG-EXT"),
                "title": f.get("title", "Attack Surface Finding"),
                "asset": f.get("asset", "unknown"),
                "severity": sev,
                "points_deducted": points,
                "reason": f.get("evidence") or f.get("description") or "External perimeter exposure"
            })
            base_score -= points

    final_score = max(0, min(100, int(round(base_score))))
    return {
        "score": final_score,
        "base_score": 100,
        "total_deducted": 100 - final_score,
        "asset_count": asset_count,
        "deductions": deductions,
        "methodology": "Score starts at 100. Deductions are strictly evidence-based: Critical exposed admin ports (-25), High CVEs/vulns (-15), Medium sensitive endpoints (-10), Low observable dev/staging assets (-5)."
    }

def calculate_threat_intel_breakdown(findings: List[Dict[str, Any]], breach_count: int) -> Dict[str, Any]:
    """
    Computes Threat Intelligence score (0-100) and itemized evidence breakdown.
    """
    base_score = 100.0
    deductions = []
    
    if breach_count > 0:
        breach_deduction = min(50.0, breach_count * 6.0)
        base_score -= breach_deduction
        deductions.append({
            "finding_id": "BG-THREAT-BREACHES",
            "title": f"Correlated Public Breach Dumps ({breach_count} observed)",
            "asset": "domain-wide",
            "severity": "high" if breach_count >= 3 else "medium",
            "points_deducted": breach_deduction,
            "reason": f"{breach_count} distinct public breach disclosures index credentials associated with this domain."
        })

    for f in findings:
        if f.get("category") == "threat_intel":
            sev = f.get("severity", "low")
            points = 5.0
            if sev == "critical":
                points = 20.0
            elif sev == "high":
                points = 15.0
            elif sev == "medium":
                points = 5.0
                
            deductions.append({
                "finding_id": f.get("finding_id", "BG-THREAT"),
                "title": f.get("title", "Threat Intelligence Indicator"),
                "asset": f.get("asset", "domain-wide"),
                "severity": sev,
                "points_deducted": points,
                "reason": f.get("evidence") or f.get("description") or "Threat reputation flag"
            })
            base_score -= points

    final_score = max(0, min(100, int(round(base_score))))
    return {
        "score": final_score,
        "base_score": 100,
        "total_deducted": 100 - final_score,
        "breach_count": breach_count,
        "deductions": deductions,
        "methodology": "Score starts at 100. Deducts 6 points per verified public breach exposure plus deductions for active threat intelligence correlation."
    }

def calculate_credential_breakdown(exposures: List[Any]) -> Dict[str, Any]:
    """
    Computes Credential Exposure score (0-100) from monitored identity exposure records.
    """
    base_score = 100.0
    deductions = []
    
    for exp in exposures:
        status = getattr(exp, "status", "open")
        sev = getattr(exp, "severity", "low")
        email = getattr(exp, "email", "monitored identity")
        source = getattr(exp, "source_name", "Breach feed")
        
        if status == "open":
            if sev == "critical":
                pts = 20.0
            elif sev == "high":
                pts = 12.0
            elif sev == "medium":
                pts = 6.0
            else:
                pts = 2.0
                
            base_score -= pts
            deductions.append({
                "source": source,
                "asset": email,
                "severity": sev,
                "status": status,
                "points_deducted": pts,
                "reason": f"Active unmitigated {sev} credential exposure in {source}"
            })
        elif status == "remediated":
            base_score = min(100.0, base_score + 2.0)

    final_score = max(0, min(100, int(round(base_score))))
    return {
        "score": final_score,
        "base_score": 100,
        "total_deducted": 100 - final_score,
        "exposure_count": len(exposures),
        "deductions": deductions,
        "methodology": "Score starts at 100. Deducts for active open exposures: Critical plaintext/botnet (-20), High password hash (-12), Medium metadata (-6), Low info (-2). Remediated exposures restore points."
    }

def compute_unified_risk(
    attack_surface_findings: List[Dict[str, Any]],
    assets_count: int,
    email_sec_score: int,
    threat_intel_findings: List[Dict[str, Any]],
    breaches_count: int,
    exposures: List[Any],
    email_sec_details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Computes unified category scores, scoring breakdowns, and overall external cyber risk score.
    Weights:
    - Attack Surface: 30%
    - Email Security: 25%
    - Public Threat Intelligence: 20%
    - Credential Exposure: 25%
    """
    as_breakdown = calculate_attack_surface_breakdown(attack_surface_findings, assets_count)
    ti_breakdown = calculate_threat_intel_breakdown(threat_intel_findings, breaches_count)
    cred_breakdown = calculate_credential_breakdown(exposures)

    as_score = as_breakdown["score"]
    ti_score = ti_breakdown["score"]
    cred_score = cred_breakdown["score"]

    # Email security breakdown
    email_deductions = []
    if email_sec_score < 100:
        if email_sec_details:
            dmarc_pol = email_sec_details.get("dmarc_policy", "none")
            if dmarc_pol == "none":
                email_deductions.append({
                    "reason": "DMARC policy set to p=none (monitoring only, not enforced)",
                    "points_deducted": 20,
                    "impact": "Fraudulent emails failing authentication are still delivered to recipient inboxes"
                })
            elif dmarc_pol in ("missing", "fail"):
                email_deductions.append({
                    "reason": "DMARC record missing or failing validation",
                    "points_deducted": 40,
                    "impact": "No domain-level email spoofing protection active"
                })
            if email_sec_details.get("spf_status") != "pass":
                email_deductions.append({
                    "reason": "SPF record missing or permissive (+all)",
                    "points_deducted": 25,
                    "impact": "Inbound mail relays cannot verify authorized senders"
                })
        else:
            email_deductions.append({
                "reason": "DMARC or SPF posture gaps identified during DNS reconnaissance",
                "points_deducted": 100 - email_sec_score,
                "impact": "Email anti-spoofing policy is not fully enforced"
            })

    eml_breakdown = {
        "score": email_sec_score,
        "base_score": 100,
        "total_deducted": 100 - email_sec_score,
        "deductions": email_deductions,
        "methodology": "Score is derived from RFC 7208 (SPF), RFC 7489 (DMARC policy enforcement), discoverable DKIM, MX hosts, and transport security (MTA-STS / TLS-RPT / DNSSEC)."
    }

    # Weighted posture score (0-100, where 100 is optimal security posture)
    as_contribution = round(as_score * 0.30, 2)
    eml_contribution = round(email_sec_score * 0.25, 2)
    ti_contribution = round(ti_score * 0.20, 2)
    cred_contribution = round(cred_score * 0.25, 2)

    posture_score = as_contribution + eml_contribution + ti_contribution + cred_contribution

    # Invert posture score to obtain External Cyber Risk Score (where 100 is maximum risk)
    overall_risk = int(round(100.0 - posture_score))
    overall_risk = max(0, min(100, overall_risk))

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

    breakdown = {
        "formula": "Overall Risk = 100 - [(30% × Attack Surface Posture) + (25% × Email Posture) + (20% × Threat Intel Posture) + (25% × Credential Posture)]",
        "weighted_posture_score": round(posture_score, 1),
        "overall_risk_score": overall_risk,
        "weights": {
            "attack_surface": 0.30,
            "email_security": 0.25,
            "threat_intelligence": 0.20,
            "credential_exposure": 0.25
        },
        "pillar_contributions": {
            "attack_surface": { "score": as_score, "weight": 0.30, "posture_points": as_contribution, "risk_points": round((100 - as_score) * 0.30, 1) },
            "email_security": { "score": email_sec_score, "weight": 0.25, "posture_points": eml_contribution, "risk_points": round((100 - email_sec_score) * 0.25, 1) },
            "threat_intelligence": { "score": ti_score, "weight": 0.20, "posture_points": ti_contribution, "risk_points": round((100 - ti_score) * 0.20, 1) },
            "credential_exposure": { "score": cred_score, "weight": 0.25, "posture_points": cred_contribution, "risk_points": round((100 - cred_score) * 0.25, 1) }
        },
        "pillars": {
            "attack_surface": as_breakdown,
            "email_security": eml_breakdown,
            "threat_intelligence": ti_breakdown,
            "credential_exposure": cred_breakdown
        }
    }

    return {
        "overall_risk_score": overall_risk,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "categories": {
            "attack_surface": as_score,
            "email_security": email_sec_score,
            "threat_intelligence": ti_score,
            "credential_exposure": cred_score
        },
        "scoring_breakdown": breakdown
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
