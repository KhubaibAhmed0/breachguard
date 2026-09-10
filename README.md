# BreachGuard — Dark Web & Breach Exposure Monitoring Platform

**BreachGuard** is a complete, production-ready B2B cybersecurity SaaS platform that continuously monitors breach databases, stealer logs, and underground leak dumps for employee credentials, exposed API keys, and corporate asset leaks.

---

## 🚀 Live Demo & Local Quickstart

### Pre-configured Test Account
- **URL**: [http://localhost:3000](http://localhost:3000)
- **Email**: `admin@acme.com`
- **Password**: `password123`
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Architecture

```
darkweb-monitor/
├── backend/                  # FastAPI Python Backend
│   ├── core/                 # App settings, DB session, JWT/Bcrypt security
│   ├── models/               # SQLAlchemy models (User, Org, Domain, Exposure, Report, etc.)
│   ├── schemas/              # Pydantic v2 request/response schemas
│   ├── routers/              # API routes (auth, domains, exposures, reports, prospect, billing)
│   ├── services/             # Core engines:
│   │   ├── scan_service.py   # Scan orchestrator, deduplication, severity scoring
│   │   ├── hibp_service.py   # HaveIBeenPwned API v3 client with rate-limiting & backoff
│   │   ├── leakcheck_service.py # LeakCheck integration
│   │   ├── risk_score_service.py # 0-100 dynamic risk score algorithm
│   │   ├── report_service.py # Executive HTML/PDF security report generator
│   │   └── alert_service.py  # Email & webhook notification dispatcher
│   ├── seed.py               # Database seeder with realistic test enterprise data
│   └── requirements.txt
└── frontend/                 # Next.js 14 App Router + TailwindCSS + Recharts
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx      # Public landing page with live "Scan Your Domain" lead-gen tool
    │   │   ├── dashboard/    # Security operations overview (Risk Score gauge, charts, feed)
    │   │   ├── domains/      # Monitored domain management & DNS verification
    │   │   ├── exposures/    # Filterable data table of exposed credentials
    │   │   ├── reports/      # Executive and compliance report generator & downloads
    │   │   ├── settings/     # Multi-tenant settings, webhook integrations, billing
    │   │   ├── login/        # Authentication login page
    │   │   └── register/     # Self-serve onboarding page
    │   ├── components/       # Modern SOC dark-theme UI components
    │   └── hooks/            # TanStack React Query API hooks
```

---

## 🏃 Running the Application

### 1. Start the Backend API
```bash
cd backend
# Activate virtual environment
.\venv\Scripts\activate
# Start FastAPI on port 8000
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the Frontend Dashboard
```bash
cd frontend
# Start Next.js on port 3000
npm run dev
# or production mode:
npm run start -- -p 3000
```

---

## 💼 The Business & Sales Engine

### 1. The "Trojan Horse" Cold Outreach
1. Enter a target prospect domain into the public scanner (`POST /api/prospect/scan` or via the landing page).
2. The scanner generates a redacted risk summary showing breached accounts and severity levels.
3. Send a cold email with their redacted findings:
   > *"We ran an automated perimeter scan on your domain and identified 23 exposed credentials across 4 known breaches. Here is your free executive summary..."*
4. Offer them a 1-click login or demo to view remediation steps.

### 2. Monetization Tiers
- **Starter ($99/mo)**: 1 Domain, weekly scans, email alerts.
- **Professional ($299/mo)**: 5 Domains, daily scans, Slack/webhook integrations, PDF reports.
- **Enterprise / MSP ($799+/mo)**: Unlimited domains, real-time alerting, multi-tenant sub-client management.
