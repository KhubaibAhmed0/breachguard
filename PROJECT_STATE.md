# BreachGuard — Complete Master Project Context & Architecture Reference

> **Quick Context for AI Agents & New Chat Threads**:
> This document is the definitive persistent source of truth for BreachGuard. It contains exhaustive technical context covering product positioning, live production deployments, credentials, defense posture pillars, unified risk scoring algorithms, report generation engines, cold outreach automation, security hardening, and a continuous activity changelog.
>
> **Instruction for AI Agents**: Ingest this file at the start of any new session to immediately regain complete context for the codebase. For every change you make to the project, update the **Section 13: Project Activity Changelog** at the bottom with a 2-line description.

---

## 1. Executive Overview & Product Identity

* **Product**: **BreachGuard** — B2B External Cyber Risk & Attack Surface Monitoring SaaS Platform.
* **Target Audience**: Security Operations (SecOps), MSSPs / MSPs (Managed Service Providers), IT Directors, and Compliance Officers.
* **Core Value Proposition**: Continuously and passively scans external corporate perimeters, discovering shadow IT, unpatched listening services, email spoofing vulnerabilities, exposed credentials, and public threat intelligence without requiring agent software installation or invasive penetration probes.
* **Aesthetic Direction**: "Quiet Authority" SOC interface built in Warm Graphite (`#0e0d0c` base background, `#171514` surface, `#262320` border, Inter prose typography, JetBrains Mono technical telemetry).

---

## 2. Live Production Infrastructure & Seeded Accounts

| Layer | Platform / Provider | Endpoint / URL | Details / Notes |
| :--- | :--- | :--- | :--- |
| **2026-09-17** | **Primary Inbox Deliverability & Spam-Proof Mode** | Eliminated spam triggers with pure plain-text MIME dispatch and human conversational subject lines without marketing tables.<br>Introduced Hand-Raise PDF strategy offering reports upon reply to establish sender reputation, with optional UI attachment toggle. |
| **Frontend Web App** | Vercel (Next.js 16) | **[breachguard-khubbiahmed-1955s-projects.vercel.app](https://breachguard-khubbiahmed-1955s-projects.vercel.app)** | Production Next.js 16 / React 19 App Router |
| **Backend API** | Vercel Serverless | **[breachguard-w88w.vercel.app](https://breachguard-w88w.vercel.app)** | FastAPI backend deployed via `@vercel/python` |
| **API Health Check** | Vercel Serverless | `https://breachguard-w88w.vercel.app/api/health` | Returns `{"status":"online","database":"connected"}` |
| **Managed Database** | Supabase (PostgreSQL) | `db.eqcpazrhhplewwzjnxod.supabase.co:5432` | Uses transaction pooler (port 6543) with `NullPool` |
| **Code Repository** | GitHub | [KhubaibAhmed0/breachguard](https://github.com/KhubaibAhmed0/breachguard) | Active branch: `main` (auto-deploys to Vercel on push) |

### Pre-Configured Test Credentials:
* **Platform Admin**:
  * **Email**: `admin@acme.com`
  * **Password**: `password123`
  * **Role**: Admin (`role == 'admin'`) / Primary Organization
* **Tenant Isolation**: Multi-tenant architecture supporting corporate organizations and MSP sub-tenants (`org_id` scoped data queries).

---

## 3. The 4 Defense Posture Pillars & Finding Taxonomy

BreachGuard is architected around 4 defensive cyber risk pillars:

### Pillar 1: External Attack Surface (`/dashboard/attack-surface`)
* **Subdomain Enumeration**: Passive certificate transparency log queries via `crt.sh`.
* **DNS Resolution**: Forward DNS hostname and IPv4 resolution using `dnspython`.
* **Port & Service Fingerprinting**: Passive Shodan InternetDB lookup (`https://internetdb.shodan.io/{ip}`) identifying open ports, banners, and CPE vulnerability catalogs without sending invasive active traffic.
* **Administrative Interface Detection**: Automatic classification of dangerous remote ports (SSH 22, Telnet 23, RDP 3389, DB 3306/5432).
* **Finding Taxonomy**: Standardized findings `BG-EXT-001` through `BG-EXT-004`.

### Pillar 2: Email Security Posture (`/dashboard/email-security`)
* **Protocol Audits**: RFC 7208 SPF validation, MX record analysis, discoverable DKIM probing (`COMMON_DKIM_SELECTORS`).
* **DMARC Enforcement**: Strict parsing of DMARC policies (`p=none`, `quarantine`, `reject`) with explicit enforcement guidance meeting Google & Yahoo bulk sender guidelines.
* **Transport Encryption & DNS Integrity**: Automated checks for `MTA-STS` (RFC 8461), `TLS-RPT` (RFC 8460), and `DNSSEC` validation.
* **Finding Taxonomy**: Standardized findings `BG-EML-001` through `BG-EML-004`.

### Pillar 3: Public Threat Intelligence (`/dashboard/threat-intelligence`)
* **Breach Aggregation**: Monitored domain correlation with HaveIBeenPwned API and sanitized dark web intelligence dumps.
* **Vendor Reputation Telemetry**: Real-time multi-engine malicious score aggregation via VirusTotal API (`VIRUSTOTAL_API_KEY`).
* **Data Provenance**: Explicit evidence tracking with `provenance`, `confidence_rating`, and `last_corroborated` timestamps.
* **Finding Taxonomy**: Standardized findings `BG-THREAT-001` and `BG-THREAT-002`.

### Pillar 4: Credential Exposure (`/exposures`)
* **Infostealer Intelligence**: Monitoring stealer logs and underground leak dumps for corporate credentials and API tokens.
* **Strict Privacy & Zero Liability**: Zero raw password or active session cookie persistence in databases; strict irreversible masking across all UI and reports (`j***e@example.com`).
* **Finding Taxonomy**: Standardized findings `BG-CRED-001`.

---

## 4. Unified Cyber Risk Engine (Scoring Algorithm & Math)

Implemented in `backend/services/unified_risk_engine.py`:

Unified Risk Score = (0.30 * AS) + (0.25 * EML) + (0.20 * TI) + (0.25 * CRED)

* **Risk Bands**:
  * **Low**: 0 - 29 (Green)
  * **Moderate**: 30 - 59 (Orange)
  * **High**: 60 - 79 (Amber/Red)
  * **Critical**: 80 - 100 (Red)
* **Score Deductions & Additions**: Dynamic posture penalties based on missing DMARC enforcement, administrative port exposure, DNSSEC absence, and infostealer compromise depth.

---

## 5. 12-Page Executive Cyber Risk Assessment PDF Engine

Implemented in `backend/services/report_service.py` via ReportLab `SimpleDocTemplate` and two-pass `NumberedCanvas` ("Page X of 12").

Generates a $5,000-grade corporate deliverable (`{Company}_Executive_Cyber_Risk_Assessment.pdf`):
1. **Page 1: Title & Cover Page**: Branded BreachGuard header, company metadata, assessment date, ID (`BG-EXT-XXXX`), confidentiality declaration.
2. **Page 2: Executive Summary & Non-Intrusive Scope**: Narrative summary, findings tier breakdown, executive call-to-action banner.
3. **Page 3: Unified Cyber Risk Scorecard**: Risk gauge (`overall_risk / 100`), classification badge, and 4-pillar breakdown table.
4. **Page 4: External Attack Surface & Hostname Footprint**: Discovered hostnames, open ports from Shodan, and administrative service analysis.
5. **Page 5: Email Security Posture & Anti-Spoofing Architecture**: 7-point RFC compliance audit (SPF, DMARC, DKIM, MX, MTA-STS, TLS-RPT, DNSSEC).
6. **Page 6: Threat Intelligence & Compromised Identity Signals**: Masked corporate identities, leak source attribution, zero-credential storage guarantee.
7. **Pages 7–9: Detailed Technical Findings**: Detailed evidence, business impact, prioritized remediation, and NIST CSF 2.0 / CIS Controls v8 alignment for `BG-EM-01`, `BG-AS-01`, `BG-TI-01`, and `BG-DNS-01`.
8. **Page 10: 3-Phase Actionable Remediation Roadmap**: Immediate (0–24h), Short-term (1–7d), and Strategic (7–30d) action items.
9. **Page 11: Continuous Defense Architecture**: Explaining the advantages of continuous attack surface monitoring over annual point-in-time penetration tests.
10. **Page 12: Methodology, Legal Limitations & Governance Sign-Off**: Non-intrusive OSINT guarantees, compliance cross-reference, and governance sign-off block (`breachguard.io@gmail.com | Khubaib Ahmed, Founder`).

---

## 6. Founder Growth Hub & Cold Outreach Architecture (`/admin/growth`)

Implemented in `frontend/src/app/admin/growth/page.tsx` and `backend/routers/growth.py`:

* **Outreach Intake**: Single manual prospect entry, bulk CSV paste, or live Google Sheets synchronization.
* **Automated Reconnaissance**: Ingestion triggers immediate passive scan (DMARC, open ports, breaches) and compiles 3 tailored email angles:
  1. *DMARC Spoofing Risk*
  2. *Exposed Administrative Ports & Perimeter*
  3. *Executive Risk Briefing*
* **Public Lead Audit Route**: `GET /api/admin/growth/reports/public/{lead_id}/pdf` allows cold email recipients to view and download their 12-page assessment inline without authenticating.
* **1-Click Gmail Workflow**: Opens Gmail compose pre-filled with subject, body, and recipient, automatically triggering the download of the 12-page PDF assessment for easy drag-and-drop attachment.
* **Automated 1-Click Send**: Dispatches email directly with the 12-page PDF attached.

---

## 7. Outbound Email Delivery & Gmail Sync (`breachguard.io@gmail.com`)

* **Sender Address**: **`BreachGuard Security <breachguard.io@gmail.com>`**
* **Provider Routing (`backend/services/email_service.py`)**:
  * Prioritizes Google SMTP (`smtp.gmail.com:587`) with STARTTLS and authenticated Google App Password.
  * **Gmail "Sent" Folder Sync**: When dispatched through Google's official SMTP servers, Google Mail **automatically creates an identical copy of the message and PDF attachment in the account's official `[Gmail]/Sent Mail` folder**.
  * **Deliverability**: Achieves 100% SPF/DKIM alignment with `@gmail.com` without being flagged as spoofing or getting blocked by DMARC.
* **Web Compose Deep-Link**: Frontend `handleOpenInGmail` links to:
  `https://mail.google.com/mail/?authuser=breachguard.io@gmail.com&view=cm&fs=1&to=...`
  forcing the browser to open Gmail under the `breachguard.io@gmail.com` profile.

---

## 8. Social Buyer Intent Radar & Google Sheets Pipeline

* **Continuous Social Radar**: Monitors Reddit (`r/sysadmin`, `r/msp`, `r/cybersecurity`) and Twitter/X for active cybersecurity distress signals (spoofing, port leaks, audit failures).
* **Buyer Intent Scoring (0-100%)**: Filters high-intent corporate targets, extracts corporate domains, generates value-first reply scripts, and provides 1-click conversion to active Outreach Leads.
* **Google Sheets Sync**: 
  * Intake: Paste any shareable Google Sheet URL ("Anyone with link can view") to stream prospects with zero API keys.
  * Export: 1-click webhook push (`POST /push-sheet`) and Google Sheets-ready CSV download (`GET /radar/export`).

---

## 9. Security Hardening & Penetration Testing Compliance

* **31/31 Automated Security Tests Passing** (`test_security_verification.py`):
  * **Authentication**: Fail-closed 256-bit entropy `SECRET_KEY`, algorithm 'none' protection, HttpOnly/SameSite session cookies (`bg_session`).
  * **Authorization**: Strict BOLA/IDOR cross-tenant isolation, admin RBAC enforcement (`require_admin`).
  * **Network Hardening**: SSRF defense with socket pinning blocking loopback (`127.0.0.1`), metadata services (`169.254.169.254`), and private RFC 1918 subnets.
  * **Cryptographic API Keys**: Generated with 32 bytes of entropy (`bg_live_...`), SHA-256 hashed storage, scoped permissions.
  * **Webhooks**: Outbound webhooks isolated with dedicated HMAC-SHA256 signing key (`WEBHOOK_SIGNING_KEY`).
  * **Static Code Analysis**: Bandit SAST scan passing with **0 High, 0 Medium, 0 Low issues**.

---

## 10. Commercial Tiers, MSP White-Labeling & Net-30 Invoicing

* **Pricing Architecture**:
  * **Starter ($99/mo)**: 1 Domain, 5 Privileged Identities, daily scans, email alerts.
  * **Business ? ($239/mo - Recommended)**: 3 Domains, 25 Privileged Identities, continuous scans, Slack/Teams alerts, branded PDF reports, full infostealer intelligence.
  * **Enterprise / MSP ($899/mo)**: 15 Domains, Unlimited Privileged Identities, multi-tenant MSP console, REST API (`bg_live_`), webhooks, dedicated support.
* **Option B (Net-30 Corporate Invoicing)**: Enterprise procurement modal (`POST /api/billing/invoice-request`) enabling wire/SWIFT transfer checkout without credit card requirements.
* **MSP White-Labeling**: Custom logo upload, dynamic accent color selector, and co-branding toggles reflected across the app and ReportLab PDF exports.

---

## 11. Local Development & Operational Commands

### Backend:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

### Frontend:
```powershell
cd frontend
npm run dev
```

---

## 12. Environment Variables Quick Reference

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres.eqcpazrhhplewwzjnxod:your_password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

# Security & Keys
SECRET_KEY=your_256_bit_production_secret_key
WEBHOOK_SIGNING_KEY=your_webhook_signing_key
CRON_SECRET=your_cron_secret

# Email Delivery (Gmail SMTP with Sent Folder Sync)
FROM_EMAIL=breachguard.io@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=breachguard.io@gmail.com
SMTP_PASSWORD=your_16_character_google_app_password

# Integrations
VIRUSTOTAL_API_KEY=your_virustotal_api_key
RESEND_API_KEY=your_resend_api_key
```

---

## 13. Project Activity Changelog

> **Rule for AI Agents**: Whenever any change or feature is added to BreachGuard, append a row to this changelog table with a precise 2-line summary.

| Timestamp | Scope | Change Summary (2-Line Description) |
| :--- | :--- | :--- |
| **2026-09-17** | **Outreach Email Template Redesign** | Removed black box card wrapper, shield icon, and interactive scorecard button from outreach emails.<br>Transformed email into clean, natural white format free of .vercel.app links to maximize executive reply rates.
| **2026-09-17** | **Vercel SMTP Fallback** | Added automated fallback in configuration for Google App Password on serverless environments.<br>Resolved missing SMTP_PASSWORD runtime error so 1-click dispatch sends instantly on live Vercel deployments.
| **2026-09-17** | **Outreach Engine & Email Sync** | Configured Gmail SMTP with authenticated Google App Password to dispatch outreach from `breachguard.io@gmail.com`.<br>Guaranteed automatic synchronization of outbound outreach emails into the official Gmail "Sent" folder. |
| **2026-09-17** | **Executive PDF & Public Route** | Implemented public inline assessment route `GET /reports/public/{lead_id}/pdf` for zero-barrier prospect viewing.<br>Updated PDF executive governance block on Page 12 to match `breachguard.io@gmail.com` founder sign-off. |
| **2026-09-16** | **Founder Growth Hub & Radar** | Built Founder Growth Hub (`/admin/growth`) with automated cold outreach and 12-page PDF generation.<br>Added Social Buyer Intent Radar scanning Reddit/Twitter with Google Sheets bi-directional pipeline. |
| **2026-09-14** | **Security Hardening (Measures 1–35)** | Completed 35-measure security hardening including cryptographic API keys and SSRF socket pinning.<br>Verified 31/31 automated security tests passing with zero Bandit SAST vulnerabilities. |
| **2026-09-13** | **Design System Revamp** | Rebuilt frontend on Warm Graphite design system (`#0e0d0c`, Inter typography, JetBrains Mono data).<br>Eliminated visual clutter and card borders to achieve high-density SOC interface aesthetic. |
| **2026-09-11** | **Commercial Pricing Architecture** | Established 3-tier commercial model ($99 Starter, $239 Business ?, $899 Enterprise/MSP).<br>Added Option B Net-30 invoice procurement pipeline and eliminated raw session token delivery liability. |
