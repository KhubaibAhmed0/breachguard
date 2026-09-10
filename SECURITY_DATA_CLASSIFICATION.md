# BreachGuard Threat Intelligence: Data Classification and Handling Policy

## 1. Executive Summary and Purpose
BreachGuard processes corporate credentials, dark web dumps, infostealer malware logs, and identity exposure metadata. This document establishes BreachGuard's formal Data Classification Matrix, access controls, least-privilege boundaries, and handling standards across all application tiers.

---

## 2. Data Classification Matrix

| Classification Tier | Data Types and Assets | Handling and Storage Requirements | Access Control and Least Privilege |
| :--- | :--- | :--- | :--- |
| **Tier 1: Public Intelligence** | - Domain existence / FQDNs<br>- High-level breach statistics<br>- Industry breach count aggregates<br>- Public threat advisory headers | - Transport encryption (TLS 1.3)<br>- Cached in-memory with 30-min TTL<br>- No PII permitted | - Unauthenticated public scanner<br>- Rate limited per IP (10 req/min)<br>- Abuse monitoring enforced |
| **Tier 2: Confidential Operational Data** | - Monitored domain configs<br>- Privileged employee email lists<br>- Webhook endpoint configurations<br>- Audit logs and scan schedules | - Encrypted in transit and at rest (AES-256)<br>- Scoped strictly by `org_id`<br>- BOLA / IDOR query isolation | - Authenticated tenant members<br>- Role-Based Access Control (RBAC)<br>- Tenant administrative users only |
| **Tier 3: Restricted Threat Intelligence** | - Breach data classes (e.g. passwords, cookies)<br>- Technical provenance and confidence scores<br>- First-seen and breach detection timestamps<br>- Co-branded PDF security audit reports | - Masked credential previews (`su****3`)<br>- Scoped strictly by tenant `org_id`<br>- Tier-gated (Infostealer locked on Essential plan)<br>- Sandboxed PDF generation | - Verified tenant admins and security analysts<br>- Download requires active JWT authorization<br>- Audit logging on report generation and status updates |
| **Tier 4: Secret / Zero-Knowledge Assets** | - User account password hashes (Argon2id / bcrypt)<br>- Provider API keys (HIBP, LeakCheck)<br>- Webhook signing secrets (Stripe, Slack)<br>- JWT private signing key (`SECRET_KEY`)<br>- Database credentials / connection strings | - Never exposed in API responses, logs, or traces<br>- Stored exclusively in environment variables / secure vaults<br>- Zero raw plaintext password storage<br>- Salted cryptographic hashing | - Application runtime only<br>- Strict isolation from client endpoints<br>- Rotated regularly via secure secrets manager |

---

## 3. Core Architectural Security Principles

### 3.1 Zero-Raw-Storage Principle
BreachGuard operates under the **Zero-Raw-Storage** architectural model:
- **No Plaintext Passwords**: External breach feeds containing credentials are sanitized immediately upon ingestion. Cleartext passwords are permanently transformed into masked representations (e.g., `pa****d`) before any database insertion.
- **No Session Cookie Harvesting**: Infostealer malware telemetry is classified by evidence metadata and risk severity without persisting raw stolen session tokens or browser cookie strings.
- **Safe External Reporting**: Generated PDF and HTML audit reports summarize threat impact, remediation steps, and technical provenance without printing full stolen credential values.

### 3.2 Tenant Isolation and Multi-Tenancy Defense
- Every SQL query on `exposures`, `monitored_domains`, `monitored_emails`, and `reports` explicitly filters by `org_id == current_user.org_id`.
- MSP (Managed Service Provider) multi-tenant switching requires cryptographic JWT re-issuance scoped to verified child organizations (`parent_org_id == current_user.org_id`).
- All cross-tenant access attempts trigger security log events and fail-closed HTTP 403/404 responses.

### 3.3 Network Egress and SSRF Immunity
- All outbound HTTP requests (webhooks, notifications, provider queries) pass through `backend/core/ssrf_guard.py`.
- Loopback (`127.0.0.0/8`, `::1`), private IP ranges (RFC 1918), link-local (`169.254.0.0/16`), cloud metadata (`metadata.google.internal`), and CGNAT ranges are blocked.
- Socket connections are pinned to validated IP addresses (`PinnedDNSBackend`) to prevent DNS rebinding attacks.
- Redirects are strictly disabled (`follow_redirects=False`).

### 3.4 API Input Hardening and Mass Assignment Immunization
- Every incoming Pydantic request schema enforces `model_config = ConfigDict(extra="forbid")`.
- Privilege-bearing attributes (`org_id`, `user_id`, `role`, `is_admin`, `is_trial`, `risk_score`, `verified`, `created_at`) are derived strictly on the server from the authenticated session token and cannot be supplied by clients.
- Enums and boundary validators constrain strings, pagination limits (`1 <= limit <= 100`), and status transitions.

---

## 4. Incident Response and Abuse Monitoring
- **Automated Scanner Abuse Monitoring**: Monitored via `backend/core/scanner_monitor.py` to identify botnet scanning, multi-domain scraping, input fuzzing, and upstream provider quota exhaustion.
- **Safe Production Error Handling**: Deliberately triggered exceptions or database errors yield sanitized generic error messages (`HTTP 500`) while writing detailed structured stack traces exclusively to internal secure log streams.
