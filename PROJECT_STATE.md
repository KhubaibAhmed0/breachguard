# BreachGuard — Current Project State & Master Reference

This document serves as the persistent source of truth for BreachGuard across development sessions and new chat threads.

---

## 1. Live Production Deployment

| Layer | Platform / Provider | URL / Endpoint | Notes |
| :--- | :--- | :--- | :--- |
| **Backend API** | [Vercel Serverless](https://vercel.com) | **[https://breachguard-w88w.vercel.app](https://breachguard-w88w.vercel.app)** | Auto-deployed from GitHub `main` (`backend/` via `@vercel/python`) |
| **API Health Check** | Vercel Serverless | `https://breachguard-w88w.vercel.app/api/health` | Returns `{"status":"online","database":"connected","service":"BreachGuard Threat API"}` |
| **Web App (Frontend)** | [Vercel Next.js](https://vercel.com) | **[https://breachguard-khubbiahmed-1955s-projects.vercel.app](https://breachguard-khubbiahmed-1955s-projects.vercel.app)** | Next.js 16 app deployed from GitHub `main` (`frontend/`) |
| **Database** | [Supabase](https://supabase.com) (PostgreSQL) | `db.eqcpazrhhplewwzjnxod.supabase.co:5432` | Managed PostgreSQL with IPv4 session pooler |
| **Code Repository** | GitHub | `https://github.com/KhubaibAhmed0/breachguard` | Active branch: `main` |

---

## 2. Seeded Accounts & Credentials

* **Platform Admin**:
  * **Email**: `admin@acme.com`
  * **Password**: `password123`
  * **Role**: Admin / Primary Organization
* **Tenant Isolation**: Multi-tenant architecture supporting standard corporate organizations and managed service provider (MSP) sub-tenants.

---

## 3. Product Positioning & Implemented Features

BreachGuard is an **External Cyber Risk & Perimeter Monitoring Platform** built on 4 core pillars:

### Pillar 1: External Attack Surface
* Passive subdomain discovery via Certificate Transparency logs (`crt.sh`).
* Forward DNS hostname & IP resolution (`dnspython`).
* Passive open ports, listening services, and CPE detection via Shodan InternetDB (`https://internetdb.shodan.io/{ip}`).
* Administrative service detection (`ADMIN_PORTS`: SSH 22, Telnet 23, RDP 3389, DB ports).
* Generates standardized findings: `BG-EXT-001` through `BG-EXT-004`.
* Dedicated page: `/dashboard/attack-surface`.

### Pillar 2: Email Security Posture
* RFC-compliant DNS parsing for `SPF` (RFC 7208), `DMARC` policies (`p=none`, `quarantine`, `reject`), and `MX` records.
* Discoverable DKIM probing (`COMMON_DKIM_SELECTORS`) with accurate disclosure: *"DKIM could not be verified from publicly discoverable selectors."*
* `MTA-STS`, `TLS-RPT`, and `DNSSEC` transport security checks.
* 0–100 posture scoring engine with prioritized DMARC enforcement roadmap.
* Generates standardized findings: `BG-EML-001` through `BG-EML-004`.
* Dedicated page: `/dashboard/email-security`.

### Pillar 3: Public Threat Intelligence
* Monitored domain breach correlation via HaveIBeenPwned API (and sanitized mock datasets).
* Security vendor reputation telemetry via VirusTotal API.
* Data provenance attribution (`provenance`, `confidence_rating`, `last_corroborated`).
* Generates standardized findings: `BG-THREAT-001` and `BG-THREAT-002`.
* Dedicated page: `/dashboard/threat-intelligence`.

### Pillar 4: Credential Exposure
* Identity monitoring with zero raw password/cookie persistence.
* Strict masking across UI and exports (`j***e@example.com`).
* Generates standardized findings: `BG-CRED-001`.

---

## 4. Key Engines & Components

1. **Unified Risk Engine (`backend/services/unified_risk_engine.py`)**:
   * Weighted formula: Risk = (0.30 * AS) + (0.25 * EML) + (0.20 * TI) + (0.25 * CRED)
   * Risk Bands: Low (0–29), Moderate (30–59), High (60–79), Critical (80–100).
2. **Standardized Finding Model (`backend/models/finding.py`)**:
   * Catalog of `BG-EXT-xxx`, `BG-EML-xxx`, `BG-THREAT-xxx`, `BG-CRED-xxx` with evidence, impact, remediation, and compliance framework references (NIST CSF, CIS Controls, RFCs).
3. **10–15 Page PDF Assessment Report (`backend/services/report_service.py`)**:
   * Built with ReportLab using dynamic two-pass `NumberedCanvas` (*"Page X of Y"*).
   * Executive summary, attack surface inventory, email posture table, threat intelligence, detailed findings, remediation roadmap, and methodology limitations.
4. **Public Exposure Scanner (`/` and `POST /api/prospect/scan`)**:
   * Returns an **External Risk Snapshot** with risk score, discovered asset counts, email security evaluation, and sample findings without exposing private client threat data.
5. **Security Hardening (Measures 1–35 Verified)**:
   * 31/31 automated security verification gates passing (`test_security_verification.py`).
   * BOLA/IDOR protection, SSRF socket pinning, webhook HMAC-SHA256 signatures, cryptographic API key system (`bg_live_`), and zero secret leakage.
6. **Modern Typography & Styling**:
   * Clean **Inter** and **Roboto** typography with enlarged button badges (`text-sm px-3.5 py-1.5`) across all dashboard interfaces.
7. **Dynamic API & Universal CORS Resolution**:
   * Dynamic runtime host detection in `frontend/src/lib/api.ts` (`getApiBaseUrl()`) automatically routes requests to `localhost:8000` on dev machines and `https://breachguard-w88w.vercel.app/api` in production/Vercel previews without compile-time baking.
   * Universal CORS in `backend/main.py` allowing all Vercel preview/production domains and local development origins with full HTTP 200 preflight support.

---

## 5. Local Development Commands (If Running Locally)

* **Backend**:
  ```powershell
  cd backend
  .\venv\Scripts\Activate.ps1
  uvicorn main:app --reload --port 8000
  ```
* **Frontend**:
  ```powershell
  cd frontend
  npm run dev
  ```
