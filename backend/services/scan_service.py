import logging
import asyncio
import httpx
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.domain import MonitoredDomain, MonitoredEmail
from models.scan_job import ScanJob
from models.exposure import Exposure
from models.organization import Organization
from models.finding import Finding
from models.asset import DiscoveredAsset, EmailSecurityAssessment, RiskAssessment

from services.hibp_service import check_email_breaches, check_domain_breaches
from services.leakcheck_service import check_email as check_leakcheck
from services.alert_service import send_email_alert
from services.external_attack_surface import analyze_attack_surface
from services.email_security import analyze_email_security
from services.threat_intelligence import analyze_threat_intelligence
from services.unified_risk_engine import compute_unified_risk, deduplicate_findings
from core.ssrf_guard import safe_http_post

logger = logging.getLogger(__name__)

async def send_webhook_alert(webhook_url: str, payload: dict) -> bool:
    try:
        resp = await safe_http_post(webhook_url, json_payload=payload, timeout=10.0)
        if resp.status_code >= 400:
            logger.warning(f"Webhook alert to {webhook_url} returned HTTP {resp.status_code}")
            return False
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch webhook alert safely: {e}")
        return False

def calculate_severity(exposure_data: Dict[str, Any]) -> str:
    cred_type = exposure_data.get("credential_type", "unknown")
    source_type = exposure_data.get("source_type", "")
    source_name = exposure_data.get("source_name", "").lower()
    data_classes = [c.lower() for c in exposure_data.get("data_classes", [])]
    
    has_cookies = any("cookie" in c for c in data_classes)
    has_tokens = any("token" in c or "key" in c for c in data_classes)
    is_stealer = "stealer" in source_name or source_type == "stealer_log"
    if cred_type == "plaintext" or is_stealer or has_cookies or has_tokens:
        return "critical"
    
    has_passwords = "passwords" in data_classes or "password" in data_classes or "password hashes" in data_classes
    has_financial = any(x in data_classes for x in ["credit cards", "bank account numbers", "payment histories"])
    
    if has_passwords or has_financial:
        breach_date = exposure_data.get("breach_date")
        if breach_date:
            try:
                year = int(breach_date.split("-")[0])
                if year <= 2016 and not has_financial:
                    return "medium"
            except Exception as parse_err:
                logger.debug(f"Date parsing skipped in calculate_severity: {parse_err}")
        return "high"
        
    if "password hints" in data_classes or cred_type == "hint":
        return "medium"
        
    return "low"

async def run_domain_scan(domain_id: int, db: AsyncSession) -> Dict[str, Any]:
    """
    Executes the comprehensive unified 4-pillar external cyber risk scan:
    1. External Attack Surface (crt.sh, DNS resolution, Shodan InternetDB)
    2. Email Security Posture (SPF, DMARC, DKIM, MX, MTA-STS, TLS-RPT, DNSSEC)
    3. Public Threat Intelligence (HIBP, VirusTotal, reputation indicators)
    4. Credential Exposure (monitored identities)
    5. Deduplication, Unified Risk Scoring (0-100), and Finding Persistence
    """
    scan_job = ScanJob(domain_id=domain_id, status="running")
    db.add(scan_job)
    await db.commit()
    await db.refresh(scan_job)

    try:
        # 1. Fetch domain
        result = await db.execute(select(MonitoredDomain).where(MonitoredDomain.id == domain_id))
        domain = result.scalars().first()
        if not domain:
            raise ValueError(f"Domain {domain_id} not found")

        all_collected_findings = []

        # Concurrently execute independent security intelligence pillars
        attack_surface_task = analyze_attack_surface(domain.domain)
        email_sec_task = analyze_email_security(domain.domain)
        threat_intel_task = analyze_threat_intelligence(domain.domain)

        attack_surface_res, email_sec_res, threat_intel_res = await asyncio.gather(
            attack_surface_task,
            email_sec_task,
            threat_intel_task
        )

        all_collected_findings.extend(attack_surface_res.get("findings", []))
        all_collected_findings.extend(email_sec_res.get("findings", []))
        all_collected_findings.extend(threat_intel_res.get("findings", []))
        
        # Batch load existing assets to eliminate N+1 database queries
        existing_assets_res = await db.execute(
            select(DiscoveredAsset).where(DiscoveredAsset.domain_id == domain.id)
        )
        existing_assets_map = {a.hostname: a for a in existing_assets_res.scalars().all()}

        for asset_data in attack_surface_res.get("assets", []):
            host = asset_data.get("hostname")
            if host in existing_assets_map:
                asset_row = existing_assets_map[host]
                asset_row.ip_address = asset_data.get("ip_address")
                asset_row.open_ports = json.dumps(asset_data.get("open_ports", []))
                asset_row.services = json.dumps(asset_data.get("services", {}))
                asset_row.last_seen_at = datetime.utcnow()
            else:
                asset_row = DiscoveredAsset(
                    org_id=domain.org_id,
                    domain_id=domain.id,
                    hostname=host,
                    ip_address=asset_data.get("ip_address"),
                    open_ports=json.dumps(asset_data.get("open_ports", [])),
                    services=json.dumps(asset_data.get("services", {})),
                    technologies=json.dumps(asset_data.get("cpes", [])),
                    vulns=json.dumps(asset_data.get("vulns", [])),
                    source=asset_data.get("source", "crt.sh")
                )
                db.add(asset_row)
                existing_assets_map[host] = asset_row

        # Persist Email Security Assessment
        email_assessment = EmailSecurityAssessment(
            org_id=domain.org_id,
            domain_id=domain.id,
            domain=domain.domain,
            spf_status=email_sec_res.get("spf", {}).get("status", "fail"),
            spf_record=email_sec_res.get("spf", {}).get("record"),
            spf_details=email_sec_res.get("spf", {}).get("details"),
            dmarc_status=email_sec_res.get("dmarc", {}).get("status", "fail"),
            dmarc_record=email_sec_res.get("dmarc", {}).get("record"),
            dmarc_policy=email_sec_res.get("dmarc", {}).get("policy"),
            dmarc_details=email_sec_res.get("dmarc", {}).get("details"),
            dkim_status=email_sec_res.get("dkim", {}).get("status", "not_verifiable"),
            dkim_details=email_sec_res.get("dkim", {}).get("details"),
            mx_status=email_sec_res.get("mx", {}).get("status", "fail"),
            mx_records=json.dumps(email_sec_res.get("mx", {}).get("records", [])),
            mta_sts_status=email_sec_res.get("mta_sts", {}).get("status", "not_detected"),
            tls_rpt_status=email_sec_res.get("tls_rpt", {}).get("status", "not_detected"),
            dnssec_status=email_sec_res.get("dnssec", {}).get("status", "not_detected"),
            score=email_sec_res.get("score", 0)
        )
        db.add(email_assessment)

        # ==========================================
        # PILLAR 4: CREDENTIAL EXPOSURE (Monitored Identities)
        # ==========================================
        emails_res = await db.execute(select(MonitoredEmail).where(MonitoredEmail.domain_id == domain_id))
        emails = list(emails_res.scalars().all())
        if not emails:
            default_email = MonitoredEmail(domain_id=domain.id, email=f"admin@{domain.domain}")
            db.add(default_email)
            await db.commit()
            await db.refresh(default_email)
            emails = [default_email]

        primary_email = emails[0]
        new_exposures_count = 0
        new_high_critical = []

        # Domain level breaches
        for breach in threat_intel_res.get("breaches", []):
            source = breach.get("source_name", "Unknown Breach")
            existing = await db.execute(
                select(Exposure).where(
                    Exposure.email_id == primary_email.id,
                    Exposure.source_name == source
                )
            )
            if not existing.scalars().first():
                severity = calculate_severity(breach)
                first_seen = None
                if breach.get("breach_date"):
                    try:
                        first_seen = datetime.fromisoformat(breach["breach_date"].replace("Z", "+00:00"))
                    except Exception as err:
                        logger.debug(f"Breach date ISO parse skipped: {err}")
                
                sanitized_meta = {
                    "provider": "hibp",
                    "source_name": source,
                    "evidence_type": "domain_breach",
                    "confidence": "high" if severity in ["critical", "high"] else "moderate",
                    "breach_date": breach.get("breach_date")
                }
                new_exp = Exposure(
                    email_id=primary_email.id,
                    org_id=domain.org_id,
                    source_name=source,
                    source_type=breach.get("source_type", "breach"),
                    data_classes=breach.get("data_classes", []),
                    severity=severity,
                    credential_type=breach.get("credential_type", "domain_breach"),
                    first_seen_at=first_seen,
                    raw_data=sanitized_meta
                )
                db.add(new_exp)
                new_exposures_count += 1
                if severity in ["high", "critical"]:
                    new_high_critical.append(new_exp)

        # Query email breach sources
        for email_record in emails:
            hibp_results = await check_email_breaches(email_record.email)
            leakcheck_results = await check_leakcheck(email_record.email)
            all_results = hibp_results + leakcheck_results
            
            merged_results = {}
            for res in all_results:
                src = res["source_name"]
                if src not in merged_results:
                    merged_results[src] = res
                else:
                    existing_classes = set(merged_results[src].get("data_classes", []))
                    new_classes = set(res.get("data_classes", []))
                    merged_results[src]["data_classes"] = list(existing_classes.union(new_classes))

            for source, res in merged_results.items():
                existing = await db.execute(
                    select(Exposure).where(
                        Exposure.email_id == email_record.id,
                        Exposure.source_name == source
                    )
                )
                if existing.scalars().first():
                    continue

                severity = calculate_severity(res)
                first_seen = None
                if res.get("breach_date"):
                    try:
                        first_seen = datetime.fromisoformat(res["breach_date"].replace("Z", "+00:00"))
                    except Exception as err:
                        logger.debug(f"Email breach date parse skipped: {err}")
                
                raw_meta = res.get("raw_data") or {}
                clean_meta = {
                    "provider": raw_meta.get("provider", "threat_intel"),
                    "source_name": source,
                    "evidence_type": raw_meta.get("evidence_type", res.get("source_type", "breach")),
                    "confidence": "high" if severity in ["critical", "high"] else "moderate",
                    "has_credentials": bool(raw_meta.get("has_credentials", False)),
                    "compromise_date": res.get("breach_date")
                }
                new_exposure = Exposure(
                    email_id=email_record.id,
                    org_id=domain.org_id,
                    source_name=source,
                    source_type=res.get("source_type", "breach"),
                    data_classes=res.get("data_classes", []),
                    severity=severity,
                    credential_type=res.get("credential_type"),
                    first_seen_at=first_seen,
                    raw_data=clean_meta
                )
                db.add(new_exposure)
                new_exposures_count += 1
                if severity in ["high", "critical"]:
                    new_high_critical.append(new_exposure)

                # Map high/critical credential exposure to structured finding
                if severity in ["high", "critical"]:
                    all_collected_findings.append({
                        "finding_id": f"BG-CRED-{new_exposures_count:03d}",
                        "category": "credential_exposure",
                        "title": f"Compromised Corporate Identity Credential ({source})",
                        "severity": severity,
                        "status": "open",
                        "observed_status": "detected",
                        "confidence": "high",
                        "asset": email_record.email,
                        "evidence": f'Corporate account {email_record.email} detected in {source}. Data classes: {", ".join(res.get("data_classes", []))}.',
                        "sources": json.dumps([source, "Breach Telemetry"]),
                        "description": "A monitored identity email address was indexed in a credential dump or infostealer botnet telemetry.",
                        "security_impact": "Exfiltrated passwords or credentials may permit unauthorized access or account takeover (ATO).",
                        "recommended_remediation": "Reset password immediately across all single sign-on (SSO) and internal accounts; verify active session revocation.",
                        "references": "NIST CSF: PR.AC-1; CIS Control 6.1"
                    })

        # ==========================================
        # 5. DEDUPLICATION & FINDING PERSISTENCE
        # ==========================================
        deduped = deduplicate_findings(all_collected_findings)
        
        # Load existing findings to avoid duplicates
        existing_findings_res = await db.execute(select(Finding).where(Finding.domain_id == domain.id))
        existing_findings_map = {
            (f.category, f.asset, f.title): f for f in existing_findings_res.scalars().all()
        }

        persisted_findings_count = 0
        for f_data in deduped:
            key = (f_data.get("category"), f_data.get("asset"), f_data.get("title"))
            if key in existing_findings_map:
                existing_f = existing_findings_map[key]
                existing_f.last_observed_at = datetime.utcnow()
                existing_f.observed_status = "detected"
                existing_f.evidence = f_data.get("evidence")
            else:
                new_f = Finding(
                    finding_id=f_data.get("finding_id"),
                    org_id=domain.org_id,
                    domain_id=domain.id,
                    category=f_data.get("category"),
                    title=f_data.get("title"),
                    severity=f_data.get("severity"),
                    status=f_data.get("status", "open"),
                    observed_status="detected",
                    confidence=f_data.get("confidence", "high"),
                    asset=f_data.get("asset"),
                    evidence=f_data.get("evidence"),
                    sources=f_data.get("sources"),
                    description=f_data.get("description"),
                    security_impact=f_data.get("security_impact"),
                    recommended_remediation=f_data.get("recommended_remediation"),
                    references=f_data.get("references")
                )
                db.add(new_f)
                persisted_findings_count += 1

        # ==========================================
        # 6. UNIFIED RISK SCORE COMPUTATION
        # ==========================================
        # Fetch all active exposures for scoring
        all_exp_res = await db.execute(select(Exposure).where(Exposure.org_id == domain.org_id))
        current_exposures = all_exp_res.scalars().all()

        risk_data = compute_unified_risk(
            attack_surface_findings=[f for f in deduped if f.get("category") == "attack_surface"],
            assets_count=attack_surface_res.get("discovered_subdomains_count", 1),
            email_sec_score=email_sec_res.get("score", 50),
            threat_intel_findings=[f for f in deduped if f.get("category") == "threat_intel"],
            breaches_count=threat_intel_res.get("breaches_count", 0),
            exposures=current_exposures,
            email_sec_details=email_sec_res
        )

        # Count finding severities
        crit_count = sum(1 for f in deduped if f.get("severity") == "critical")
        high_count = sum(1 for f in deduped if f.get("severity") == "high")
        med_count = sum(1 for f in deduped if f.get("severity") == "medium")
        low_count = sum(1 for f in deduped if f.get("severity") == "low")

        # Persist RiskAssessment
        risk_assessment = RiskAssessment(
            org_id=domain.org_id,
            domain_id=domain.id,
            attack_surface_score=risk_data["categories"]["attack_surface"],
            email_security_score=risk_data["categories"]["email_security"],
            threat_intel_score=risk_data["categories"]["threat_intelligence"],
            credential_score=risk_data["categories"]["credential_exposure"],
            overall_score=risk_data["overall_risk_score"],
            risk_level=risk_data["risk_level"],
            findings_count=len(deduped),
            critical_count=crit_count,
            high_count=high_count,
            medium_count=med_count,
            low_count=low_count
        )
        db.add(risk_assessment)

        # Update domain
        domain.last_scanned_at = datetime.utcnow()
        await db.commit()

        # Update ScanJob
        scan_job.status = "completed"
        scan_job.new_exposures_found = new_exposures_count
        scan_job.completed_at = datetime.utcnow()
        await db.commit()

        # Webhook / Email Alerts for High/Critical Findings
        if new_high_critical:
            await send_email_alert(domain.org_id, new_high_critical, db)

        org_res = await db.execute(select(Organization).where(Organization.id == domain.org_id))
        org = org_res.scalars().first()
        if org and (org.slack_webhook_url or org.siem_webhook_url) and (crit_count > 0 or high_count > 0):
            alert_msg = f"*BreachGuard External Risk Alert*: {domain.domain} assessed with Risk Score {risk_data['overall_risk_score']}/100 ({risk_data['risk_level']}). {crit_count} Critical, {high_count} High findings identified."
            if org.slack_webhook_url:
                await send_webhook_alert(org.slack_webhook_url, {"text": alert_msg})
            if org.siem_webhook_url:
                await send_webhook_alert(org.siem_webhook_url, {
                    "event": "breachguard_risk_assessment",
                    "domain": domain.domain,
                    "overall_risk_score": risk_data["overall_risk_score"],
                    "risk_level": risk_data["risk_level"],
                    "critical_findings": crit_count,
                    "high_findings": high_count,
                    "timestamp": datetime.utcnow().isoformat()
                })

        try:
            from routers.risk import invalidate_risk_cache
            invalidate_risk_cache(domain.org_id)
        except Exception:
            pass

        return {
            "status": "success",
            "domain_id": domain_id,
            "overall_risk_score": risk_data["overall_risk_score"],
            "risk_level": risk_data["risk_level"],
            "categories": risk_data["categories"],
            "assets_discovered": attack_surface_res.get("discovered_subdomains_count", 1),
            "findings_count": len(deduped),
            "new_exposures_found": new_exposures_count
        }

    except Exception as e:
        logger.error(f"Scan failed for domain {domain_id}: {str(e)}")
        scan_job.status = "failed"
        scan_job.completed_at = datetime.utcnow()
        await db.commit()
        return {"status": "error", "error": str(e)}
