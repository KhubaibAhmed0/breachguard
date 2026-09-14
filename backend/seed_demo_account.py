import asyncio
import json
import os
import shutil
from datetime import datetime, timedelta
from sqlalchemy import select, delete

import bcrypt
from core.database import AsyncSessionLocal, engine, Base
from models.organization import Organization
from models.user import User
from models.domain import MonitoredDomain, MonitoredEmail
from models.exposure import Exposure
from models.asset import DiscoveredAsset, EmailSecurityAssessment, RiskAssessment
from models.finding import Finding
from models.report import Report
from models.scan_job import ScanJob

def get_hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

DEMO_EMAIL = "demo@breachguard.io"
DEMO_PASSWORD = "password123"
DEMO_ORG_NAME = "Nexus Global Defense"

DOMAINS = [
    "acme.com",
    "charizard.io",
    "cybervault.io",
    "sentinel-cloud.ai",
]

async def seed_demo():
    print("[START] Starting comprehensive demo account generation...")
    
    async with AsyncSessionLocal() as session:
        # 1. Clean up existing demo account if it already exists
        existing_user = (await session.execute(select(User).where(User.email == DEMO_EMAIL))).scalars().first()
        if existing_user:
            old_org_id = existing_user.org_id
            print(f"Cleaning up previous demo organization ID: {old_org_id}")
            await session.execute(delete(Finding).where(Finding.org_id == old_org_id))
            await session.execute(delete(Exposure).where(Exposure.org_id == old_org_id))
            await session.execute(delete(DiscoveredAsset).where(DiscoveredAsset.org_id == old_org_id))
            await session.execute(delete(EmailSecurityAssessment).where(EmailSecurityAssessment.org_id == old_org_id))
            await session.execute(delete(RiskAssessment).where(RiskAssessment.org_id == old_org_id))
            await session.execute(delete(Report).where(Report.org_id == old_org_id))
            
            # Delete monitored emails and domains
            old_domains = (await session.execute(select(MonitoredDomain).where(MonitoredDomain.org_id == old_org_id))).scalars().all()
            for d in old_domains:
                await session.execute(delete(MonitoredEmail).where(MonitoredEmail.domain_id == d.id))
                await session.execute(delete(ScanJob).where(ScanJob.domain_id == d.id))
            await session.execute(delete(MonitoredDomain).where(MonitoredDomain.org_id == old_org_id))
            await session.execute(delete(User).where(User.org_id == old_org_id))
            await session.execute(delete(Organization).where(Organization.id == old_org_id))
            await session.commit()

        # 2. Create Organization
        org = Organization(
            name=DEMO_ORG_NAME,
            plan="enterprise",
            is_msp=True,
            is_trial=False
        )
        session.add(org)
        await session.commit()
        await session.refresh(org)
        print(f"[OK] Created Organization: {org.name} (ID: {org.id}, Plan: {org.plan})")

        # 3. Create User
        user = User(
            email=DEMO_EMAIL,
            hashed_password=get_hash(DEMO_PASSWORD),
            org_id=org.id,
            role="admin"
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"[OK] Created User: {user.email} with password '{DEMO_PASSWORD}'")

        # 4. Create Monitored Domains
        now = datetime.utcnow()
        domains_map = {}
        for d_name in DOMAINS:
            dom = MonitoredDomain(
                org_id=org.id,
                domain=d_name,
                verified=True,
                verification_token=f"bg-verify-{d_name.replace('.', '-')}-demo",
                scan_frequency="daily",
                last_scanned_at=now - timedelta(hours=2)
            )
            session.add(dom)
            await session.commit()
            await session.refresh(dom)
            domains_map[d_name] = dom
        print(f"[OK] Created {len(domains_map)} Monitored Domains: {list(domains_map.keys())}")

        # 5. Create Monitored Identities (Emails)
        identities = [
            ("acme.com", "ciso@acme.com", True),
            ("acme.com", "admin@acme.com", True),
            ("acme.com", "devops@acme.com", False),
            ("charizard.io", "ash@charizard.io", True),
            ("charizard.io", "devops@charizard.io", True),
            ("charizard.io", "sec@charizard.io", False),
            ("cybervault.io", "sec-ops@cybervault.io", True),
            ("cybervault.io", "ciso@cybervault.io", True),
            ("sentinel-cloud.ai", "infra@sentinel-cloud.ai", True),
            ("sentinel-cloud.ai", "founder@sentinel-cloud.ai", False),
            ("sentinel-cloud.ai", "ai-models@sentinel-cloud.ai", False),
        ]
        emails_map = {}
        for d_name, email_addr, is_vip in identities:
            eml = MonitoredEmail(
                domain_id=domains_map[d_name].id,
                email=email_addr,
                is_vip=is_vip
            )
            session.add(eml)
            await session.commit()
            await session.refresh(eml)
            emails_map[email_addr] = eml
        print(f"[OK] Created {len(emails_map)} Monitored Identities across domains")

        # 6. Create Discovered Assets (Attack Surface)
        assets_data = [
            # acme.com
            (
                "acme.com", "api.acme.com", "198.51.100.24", "AS13335 CLOUDFLARENET",
                "Cloudflare Inc.", [80, 443], {"80": "http", "443": "https"},
                ["Cloudflare", "Nginx", "Node.js API Gateway"], []
            ),
            (
                "acme.com", "vpn.acme.com", "198.51.100.35", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [443, 1194], {"443": "ssl/openvpn", "1194": "openvpn"},
                ["OpenVPN Access Server 2.5.8"], ["CVE-2023-46805"]
            ),
            (
                "acme.com", "auth.acme.com", "198.51.100.12", "AS13335 CLOUDFLARENET",
                "Cloudflare Inc.", [80, 443], {"443": "https"},
                ["OAuth 2.0", "Keycloak Identity Broker", "TLS 1.3"], []
            ),
            (
                "acme.com", "staging-gateway.acme.com", "198.51.100.89", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [80, 443, 8080], {"8080": "http-proxy"},
                ["Apache Tomcat 9.0.50", "Spring Framework"], ["CVE-2022-22965"]
            ),
            (
                "acme.com", "mail.acme.com", "198.51.100.5", "AS15169 GOOGLE",
                "Google LLC", [25, 465, 587, 993], {"25": "smtp", "465": "smtps", "993": "imaps"},
                ["Google Workspace MX Gateway"], []
            ),

            # charizard.io
            (
                "charizard.io", "charizard.io", "203.0.113.10", "AS15169 GOOGLE",
                "Google LLC", [80, 443], {"80": "http", "443": "https"},
                ["Next.js 16 (Turbopack)", "Vercel Edge Network"], []
            ),
            (
                "charizard.io", "app.charizard.io", "203.0.113.15", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [443], {"443": "https"},
                ["React 19", "AWS Application Load Balancer"], []
            ),
            (
                "charizard.io", "telemetry.charizard.io", "203.0.113.28", "AS14061 DIGITALOCEAN",
                "DigitalOcean LLC", [443, 9090], {"9090": "prometheus-http"},
                ["Prometheus 2.45", "Grafana Enterprise"], []
            ),
            (
                "charizard.io", "battle-api.charizard.io", "203.0.113.44", "AS15169 GOOGLE",
                "Google LLC", [443, 8443], {"8443": "grpc"},
                ["Envoy Proxy", "Golang gRPC Microservices"], []
            ),
            (
                "charizard.io", "cdn.charizard.io", "203.0.113.99", "AS54113 FASTLY",
                "Fastly Inc.", [80, 443], {"80": "http", "443": "https"},
                ["Fastly Varnish Edge Cache"], []
            ),

            # cybervault.io
            (
                "cybervault.io", "vault.cybervault.io", "192.0.2.77", "AS13335 CLOUDFLARENET",
                "Cloudflare Inc.", [443], {"443": "https"},
                ["HashiCorp Vault 1.14", "Go HTTP Server", "mTLS"], []
            ),
            (
                "cybervault.io", "kms.cybervault.io", "192.0.2.88", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [443, 8200], {"8200": "vault-api"},
                ["KMS Key Custody Cluster", "TLS 1.3 Strict"], []
            ),
            (
                "cybervault.io", "bastion.cybervault.io", "192.0.2.99", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [22, 443], {"22": "ssh", "443": "https"},
                ["OpenSSH 8.9p1 (Ubuntu)"], ["CVE-2024-6387"]
            ),
            (
                "cybervault.io", "metrics.cybervault.io", "192.0.2.110", "AS13335 CLOUDFLARENET",
                "Cloudflare Inc.", [443], {"443": "https"},
                ["Datadog Security Agent", "OpenTelemetry Collector"], []
            ),

            # sentinel-cloud.ai
            (
                "sentinel-cloud.ai", "sentinel-cloud.ai", "198.18.0.50", "AS13335 CLOUDFLARENET",
                "Cloudflare Inc.", [80, 443], {"80": "http", "443": "https"},
                ["Cloudflare Pages", "Astro SSR"], []
            ),
            (
                "sentinel-cloud.ai", "inference-api.sentinel-cloud.ai", "198.18.0.65", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [443], {"443": "https"},
                ["FastAPI", "NVIDIA Triton Inference Server 24.04"], []
            ),
            (
                "sentinel-cloud.ai", "weights-cache.sentinel-cloud.ai", "198.18.0.72", "AS16509 AMAZON-02",
                "Amazon.com Inc.", [443, 9000], {"9000": "minio-s3"},
                ["MinIO High Performance S3 Object Storage"], []
            ),
            (
                "sentinel-cloud.ai", "jupyter.sentinel-cloud.ai", "198.18.0.80", "AS15169 GOOGLE",
                "Google LLC", [443, 8888], {"8888": "http-jupyter"},
                ["JupyterHub 4.0", "Python 3.11 Kernel"], ["CVE-2024-28233"]
            ),
        ]

        for d_name, hname, ip, asn, org_name, ports, services, tech, vulns in assets_data:
            ast = DiscoveredAsset(
                org_id=org.id,
                domain_id=domains_map[d_name].id,
                hostname=hname,
                ip_address=ip,
                asn=asn,
                organization_name=org_name,
                open_ports=json.dumps(ports),
                services=json.dumps(services),
                technologies=json.dumps(tech),
                vulns=json.dumps(vulns),
                source="Certificate Transparency / Shodan InternetDB",
                first_seen_at=now - timedelta(days=45),
                last_seen_at=now - timedelta(hours=3)
            )
            session.add(ast)
        await session.commit()
        print(f"[OK] Inserted {len(assets_data)} Discovered Assets across Attack Surface")

        # 7. Create Email Security Assessments
        email_assessments = [
            EmailSecurityAssessment(
                org_id=org.id,
                domain_id=domains_map["acme.com"].id,
                domain="acme.com",
                score=94,
                spf_status="pass",
                spf_record="v=spf1 include:_spf.google.com include:sendgrid.net ~all",
                spf_details="Valid SPF record with softfail mechanism and authorized mail relays configured.",
                dmarc_status="pass",
                dmarc_record="v=DMARC1; p=reject; rua=mailto:dmarc-reports@acme.com; ruf=mailto:dmarc-forensics@acme.com; pct=100; aspf=r",
                dmarc_policy="reject",
                dmarc_details="Strict DMARC enforcement active (p=reject). Unauthorized outbound spoofing will be rejected.",
                dkim_status="pass",
                dkim_details="DKIM selector 'google._domainkey.acme.com' successfully validated with 2048-bit RSA key.",
                mx_status="pass",
                mx_records=json.dumps(["aspmx.l.google.com (Priority 1)", "alt1.aspmx.l.google.com (Priority 5)"]),
                mta_sts_status="pass",
                tls_rpt_status="pass",
                dnssec_status="pass",
                created_at=now - timedelta(hours=2)
            ),
            EmailSecurityAssessment(
                org_id=org.id,
                domain_id=domains_map["charizard.io"].id,
                domain="charizard.io",
                score=68,
                spf_status="pass",
                spf_record="v=spf1 include:mailgun.org include:_spf.google.com ~all",
                spf_details="SPF authorized for Mailgun and Google Workspace senders.",
                dmarc_status="warning",
                dmarc_record="v=DMARC1; p=none; rua=mailto:aggregate-reports@charizard.io; sp=none",
                dmarc_policy="none",
                dmarc_details="DMARC record present but operating in passive monitoring mode (p=none). Spoofed emails are not blocked.",
                dkim_status="pass",
                dkim_details="DKIM signature verified for transactional mail routes.",
                mx_status="pass",
                mx_records=json.dumps(["mxa.mailgun.org (Priority 10)", "mxb.mailgun.org (Priority 10)"]),
                mta_sts_status="not_detected",
                tls_rpt_status="not_detected",
                dnssec_status="not_detected",
                created_at=now - timedelta(hours=4)
            ),
            EmailSecurityAssessment(
                org_id=org.id,
                domain_id=domains_map["cybervault.io"].id,
                domain="cybervault.io",
                score=88,
                spf_status="pass",
                spf_record="v=spf1 include:spf.protection.outlook.com -all",
                spf_details="Strict hardfail SPF record (-all) restricting email origination solely to Microsoft 365.",
                dmarc_status="pass",
                dmarc_record="v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:dmarc@cybervault.io",
                dmarc_policy="quarantine",
                dmarc_details="DMARC quarantine active (pct=100). Suspicious spoofed messages routed to recipient spam folders.",
                dkim_status="pass",
                dkim_details="Microsoft 365 selector1/selector2 CNAME keys verified.",
                mx_status="pass",
                mx_records=json.dumps(["cybervault-io.mail.protection.outlook.com (Priority 0)"]),
                mta_sts_status="pass",
                tls_rpt_status="not_detected",
                dnssec_status="pass",
                created_at=now - timedelta(hours=6)
            ),
            EmailSecurityAssessment(
                org_id=org.id,
                domain_id=domains_map["sentinel-cloud.ai"].id,
                domain="sentinel-cloud.ai",
                score=48,
                spf_status="warning",
                spf_record="v=spf1 +all",
                spf_details="CRITICAL FLAW: Permissive '+all' directive allows any IP on the public internet to send email on behalf of this domain.",
                dmarc_status="fail",
                dmarc_record=None,
                dmarc_policy="missing",
                dmarc_details="No DMARC policy record published on _dmarc.sentinel-cloud.ai. Domain is completely vulnerable to CEO fraud and spoofing.",
                dkim_status="not_verifiable",
                dkim_details="No DKIM public key published in DNS.",
                mx_status="pass",
                mx_records=json.dumps(["mail.sentinel-cloud.ai (Priority 10)"]),
                mta_sts_status="not_detected",
                tls_rpt_status="not_detected",
                dnssec_status="not_detected",
                created_at=now - timedelta(hours=8)
            ),
        ]
        session.add_all(email_assessments)
        await session.commit()
        print(f"[OK] Inserted {len(email_assessments)} Email Security Assessments")

        # 8. Create Exposures (Dark Web & Infostealer Telemetry)
        exposures_data = [
            (
                "ciso@acme.com", "Global Defense Contractor Breach", "breach",
                ["email", "passwords", "security clearance ids", "phone numbers"],
                "critical", "plaintext", now - timedelta(days=60), "open"
            ),
            (
                "admin@acme.com", "Lumma Stealer v4 Botnet Ingestion", "stealer_log",
                ["email", "passwords", "browser session cookies", "aws access keys"],
                "critical", "plaintext", now - timedelta(days=12), "open"
            ),
            (
                "devops@charizard.io", "RedLine Stealer Corporate Archive", "stealer_log",
                ["email", "master passwords", "github personal access tokens", "slack cookies"],
                "critical", "plaintext", now - timedelta(days=7), "open"
            ),
            (
                "ash@charizard.io", "Adobe Creative Cloud Data Leak", "breach",
                ["email", "password hashes", "usernames"],
                "medium", "hashed", now - timedelta(days=120), "acknowledged"
            ),
            (
                "sec-ops@cybervault.io", "Dark Web Paste - DevOps Hash Collection", "paste",
                ["email", "sha256 crypt hashes", "internal server hostnames"],
                "high", "hashed", now - timedelta(days=25), "open"
            ),
            (
                "infra@sentinel-cloud.ai", "Vidar Stealer Corporate Endpoint Exfiltration", "stealer_log",
                ["email", "ssh private keys", "openvpn configuration files", "browser autofill"],
                "critical", "plaintext", now - timedelta(days=4), "open"
            ),
            (
                "founder@sentinel-cloud.ai", "Apollo Marketing Directory Leak", "breach",
                ["email", "full names", "corporate titles", "phone numbers"],
                "low", "none", now - timedelta(days=180), "remediated"
            ),
            (
                "admin@acme.com", "Canva Customer Database Dump", "breach",
                ["email", "password hashes", "names"],
                "high", "hashed", now - timedelta(days=90), "open"
            ),
        ]

        for eml_addr, src_name, src_type, classes, sev, cred_type, seen_at, status in exposures_data:
            exp = Exposure(
                org_id=org.id,
                email_id=emails_map[eml_addr].id,
                source_name=src_name,
                source_type=src_type,
                data_classes=classes,
                severity=sev,
                credential_type=cred_type,
                first_seen_at=seen_at,
                detected_at=seen_at + timedelta(days=1),
                status=status
            )
            session.add(exp)
        await session.commit()
        print(f"[OK] Inserted {len(exposures_data)} Dark Web & Stealer Exposures")

        # 9. Create Prioritized Security Findings
        findings_data = [
            (
                "BG-EXT-201", "acme.com", "attack_surface",
                "Exposed Apache Tomcat Gateway with Potential RCE Risk",
                "critical", "open", "detected", "high",
                "staging-gateway.acme.com:8080",
                "Apache Tomcat 9.0.50 observed responding on port 8080. Known vulnerable to Spring4Shell (CVE-2022-22965) remote code execution.",
                "Shodan InternetDB, Censys Search",
                "Publicly reachable staging service allows unauthenticated requests to reach internal framework endpoints.",
                "Upgrade Apache Tomcat to >= 9.0.62 and bind port 8080 strictly to private VPC / VPN interfaces.",
                "NIST CSF PR.IP-1, CIS Control 9.2",
                now - timedelta(days=15)
            ),
            (
                "BG-EXT-202", "acme.com", "threat_intel",
                "Active Lumma Stealer Session Exfiltration for Admin Account",
                "critical", "open", "detected", "high",
                "admin@acme.com",
                "Raw credentials and valid AWS session cookies recovered from Lumma Stealer botnet intelligence feeds.",
                "Dark Web Infostealer Feed (Automated Ingestion)",
                "Attacker possessing active session tokens can bypass MFA and access corporate cloud dashboards.",
                "Immediately revoke active IAM sessions, rotate admin passwords, and run malware endpoint quarantine on compromised host.",
                "MITRE ATT&CK T1539 (Steal Web Session Cookie), CIS Control 5.4",
                now - timedelta(days=12)
            ),
            (
                "BG-EXT-203", "acme.com", "attack_surface",
                "OpenVPN Administrative Interface Exposed to Internet",
                "high", "open", "detected", "high",
                "vpn.acme.com:443",
                "OpenVPN Access Server 2.5.8 web interface accessible from public IP space.",
                "Certificate Transparency, Shodan",
                "Administrative web interfaces on network edges present high-value targets for credential stuffing and zero-day vulnerabilities.",
                "Restrict OpenVPN web management console to designated internal management subnets.",
                "CIS Control 4.1, RFC 4301",
                now - timedelta(days=30)
            ),
            (
                "BG-EXT-204", "charizard.io", "threat_intel",
                "RedLine Botnet Exfiltration Containing GitHub PAT",
                "critical", "open", "detected", "high",
                "devops@charizard.io",
                "GitHub Personal Access Token (classic) and Slack browser cookies identified in RedLine stealer dump.",
                "Dark Web Threat Telemetry",
                "Compromised developer token can permit unauthorized git repository clones and CI/CD secret manipulation.",
                "Revoke and rotate GitHub PAT immediately. Review git commit audit logs for unauthorized push activity.",
                "MITRE ATT&CK T1552.001, CIS Control 16.3",
                now - timedelta(days=7)
            ),
            (
                "BG-EXT-205", "charizard.io", "email_security",
                "DMARC Policy Set to Permissive Monitoring Mode (p=none)",
                "medium", "open", "detected", "high",
                "_dmarc.charizard.io",
                "v=DMARC1; p=none observed on public DNS query. Mailbox providers will deliver unauthenticated emails.",
                "DNS Resolver Telemetry",
                "Malicious actors can forge emails from @charizard.io with high inbox deliverability.",
                "Update DMARC policy from p=none to p=quarantine, monitor aggregate rua reports, then advance to p=reject.",
                "RFC 7489, NIST SP 800-177",
                now - timedelta(days=20)
            ),
            (
                "BG-EXT-206", "cybervault.io", "attack_surface",
                "OpenSSH Bastion Susceptible to RegreSSHion (CVE-2024-6387)",
                "high", "open", "detected", "high",
                "bastion.cybervault.io:22",
                "OpenSSH 8.9p1 detected. Vulnerable to signal handler race condition leading to potential unauthenticated RCE as root.",
                "Network Banner Inspection",
                "Remote unauthenticated attackers may attempt brute-force timing attacks to gain root shell access on the bastion.",
                "Upgrade OpenSSH to version 9.8p1 or newer. Enforce IP whitelisting or AWS Systems Manager Session Manager.",
                "CVE-2024-6387, CIS Control 9.4",
                now - timedelta(days=10)
            ),
            (
                "BG-EXT-207", "sentinel-cloud.ai", "email_security",
                "Critical SPF '+all' Policy Permits Universal Domain Spoofing",
                "high", "open", "detected", "high",
                "sentinel-cloud.ai",
                "v=spf1 +all observed in TXT records. The '+all' mechanism authorizes every IP address on the internet.",
                "DNS Resolver Inspection",
                "Attackers can conduct targeted phishing and business email compromise (BEC) impersonating company executives.",
                "Immediately change '+all' to '~all' or '-all' and specify approved outgoing mail relays.",
                "RFC 7208, CIS Control 9.5",
                now - timedelta(days=18)
            ),
            (
                "BG-EXT-208", "sentinel-cloud.ai", "threat_intel",
                "Corporate SSH Keys & VPN Configuration Disclosed in Vidar Stealer Dump",
                "critical", "open", "detected", "high",
                "infra@sentinel-cloud.ai",
                "Encrypted client OpenVPN profile (*.ovpn) and SSH private keys found in infected workstation archive.",
                "Stealer Botnet Archive Telemetry",
                "Direct perimeter gateway ingress credentials in possession of third-party threat actors.",
                "Revoke OpenVPN user certificate, rotate all authorized_keys on cloud servers, and conduct forensics on employee endpoint.",
                "MITRE ATT&CK T1552.004, CIS Control 3.3",
                now - timedelta(days=4)
            ),
            (
                "BG-EXT-209", "sentinel-cloud.ai", "attack_surface",
                "Exposed JupyterHub Dashboard on Public Cloud IP",
                "medium", "open", "detected", "high",
                "jupyter.sentinel-cloud.ai:8888",
                "JupyterHub 4.0 login portal visible without VPN requirement.",
                "Shodan / Censys Reconnaissance",
                "Interactive Python execution environments exposed to the public internet increase brute force and zero-day exposure risk.",
                "Enforce SSO authentication and place the JupyterHub portal behind Cloudflare Zero Trust or private subnet.",
                "CIS Control 12.1",
                now - timedelta(days=22)
            ),
        ]

        for fid, d_name, cat, title, sev, status, obs_status, conf, asset, evid, srcs, impact, rec, refs, seen_at in findings_data:
            fnd = Finding(
                finding_id=fid,
                org_id=org.id,
                domain_id=domains_map[d_name].id,
                category=cat,
                title=title,
                severity=sev,
                status=status,
                observed_status=obs_status,
                confidence=conf,
                asset=asset,
                evidence=evid,
                sources=json.dumps(srcs.split(", ")),
                security_impact=impact,
                recommended_remediation=rec,
                references=refs,
                first_observed_at=seen_at,
                last_observed_at=now - timedelta(hours=2)
            )
            session.add(fnd)
        await session.commit()
        print(f"[OK] Inserted {len(findings_data)} Prioritized Security Findings")

        # 10. Create Realistic Sample Audit Reports in backend/reports
        reports_dir = os.path.join(os.path.dirname(__file__), "reports")
        os.makedirs(reports_dir, exist_ok=True)

        # Find existing sample pdf to copy for realism
        existing_pdfs = [f for f in os.listdir(reports_dir) if f.endswith(".pdf")]
        sample_pdf_source = os.path.join(reports_dir, existing_pdfs[0]) if existing_pdfs else None

        reports_metadata = [
            ("acme.com", "Executive", "Executive External Cyber Risk Assessment - Q3 2026"),
            ("charizard.io", "Technical", "Attack Surface Reconnaissance & Vulnerability Audit"),
            ("cybervault.io", "Compliance", "SOC 2 & ISO 27001 External Perimeter Security Verification"),
            ("sentinel-cloud.ai", "ThreatIntel", "Dark Web & Infostealer Intelligence Briefing"),
        ]

        for d_name, r_type, title in reports_metadata:
            filename = f"Security_Report_{d_name}_{r_type}.pdf"
            file_path = os.path.join("reports", filename)
            abs_file_path = os.path.join(os.path.dirname(__file__), file_path)
            
            # Copy sample pdf or create realistic dummy file
            if sample_pdf_source and os.path.exists(sample_pdf_source):
                shutil.copyfile(sample_pdf_source, abs_file_path)
            else:
                with open(abs_file_path, "wb") as f:
                    f.write(b"%PDF-1.4 Mock Security Report Content for " + d_name.encode())

            rep = Report(
                org_id=org.id,
                report_type=r_type,
                domain_name=d_name,
                file_url=file_path,
                generated_at=now - timedelta(days=2, hours=3)
            )
            session.add(rep)
        await session.commit()
        print(f"[OK] Inserted {len(reports_metadata)} Executive & Technical Audit Reports")

        # 11. Create Risk Assessments per domain
        risk_assessments = [
            RiskAssessment(
                org_id=org.id,
                domain_id=domains_map["acme.com"].id,
                attack_surface_score=72,
                email_security_score=94,
                threat_intel_score=60,
                credential_score=55,
                overall_score=70,
                risk_level="high",
                findings_count=3,
                critical_count=2,
                high_count=1,
                medium_count=0,
                low_count=0,
                created_at=now - timedelta(hours=2)
            ),
            RiskAssessment(
                org_id=org.id,
                domain_id=domains_map["charizard.io"].id,
                attack_surface_score=85,
                email_security_score=68,
                threat_intel_score=65,
                credential_score=60,
                overall_score=69,
                risk_level="high",
                findings_count=2,
                critical_count=1,
                high_count=0,
                medium_count=1,
                low_count=0,
                created_at=now - timedelta(hours=4)
            ),
            RiskAssessment(
                org_id=org.id,
                domain_id=domains_map["cybervault.io"].id,
                attack_surface_score=80,
                email_security_score=88,
                threat_intel_score=75,
                credential_score=70,
                overall_score=78,
                risk_level="critical",
                findings_count=1,
                critical_count=0,
                high_count=1,
                medium_count=0,
                low_count=0,
                created_at=now - timedelta(hours=6)
            ),
            RiskAssessment(
                org_id=org.id,
                domain_id=domains_map["sentinel-cloud.ai"].id,
                attack_surface_score=65,
                email_security_score=48,
                threat_intel_score=40,
                credential_score=45,
                overall_score=82,
                risk_level="critical",
                findings_count=3,
                critical_count=1,
                high_count=1,
                medium_count=1,
                low_count=0,
                created_at=now - timedelta(hours=8)
            ),
        ]
        session.add_all(risk_assessments)
        await session.commit()
        print(f"[OK] Inserted Risk Assessments for all 4 domains")

        print("\n[DONE] DEMO SEEDING COMPLETED SUCCESSFULLY!")
        print(f"==================================================")
        print(f"  Organization : {DEMO_ORG_NAME} (Enterprise Plan)")
        print(f"  Login Email  : {DEMO_EMAIL}")
        print(f"  Password     : {DEMO_PASSWORD}")
        print(f"  Domains (4)  : {', '.join(DOMAINS)}")
        print(f"==================================================")

if __name__ == "__main__":
    asyncio.run(seed_demo())
