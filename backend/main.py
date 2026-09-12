import os
import asyncio
import logging
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.future import select

from core.config import settings
from core.database import Base, engine, AsyncSessionLocal
from models.domain import MonitoredDomain
from services.scan_service import run_domain_scan
from routers import (
    auth, domains, exposures, reports, prospect, billing,
    identities, integrations, msp, api_keys,
    attack_surface, email_security, findings, risk,
    team, cron
)

logger = logging.getLogger(__name__)

# Ensure tables and dynamic columns exist
async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def sync_columns(connection):
            try:
                raw_url = str(connection.engine.url)
                if "sqlite" in raw_url:
                    cursor = connection.connection.cursor()
                    cursor.execute("PRAGMA table_info(organizations)")
                    cols = [r[1] for r in cursor.fetchall()]
                    needed_cols = [
                        ("is_msp", "BOOLEAN DEFAULT 0"),
                        ("parent_org_id", "INTEGER"),
                        ("logo_path", "VARCHAR"),
                        ("slack_webhook_url", "VARCHAR"),
                        ("siem_webhook_url", "VARCHAR"),
                        ("webhook_secret", "VARCHAR"),
                        ("is_trial", "BOOLEAN DEFAULT 0"),
                        ("trial_ends_at", "DATETIME"),
                    ]
                    for c_name, c_def in needed_cols:
                        if c_name not in cols:
                            cursor.execute(f"ALTER TABLE organizations ADD COLUMN {c_name} {c_def}")

                    cursor.execute("PRAGMA table_info(users)")
                    u_cols = [r[1] for r in cursor.fetchall()]
                    if "password_changed_at" not in u_cols:
                        cursor.execute("ALTER TABLE users ADD COLUMN password_changed_at DATETIME")

                    cursor.execute("PRAGMA table_info(monitored_domains)")
                    d_cols = [r[1] for r in cursor.fetchall()]
                    if "verification_token" not in d_cols:
                        cursor.execute("ALTER TABLE monitored_domains ADD COLUMN verification_token VARCHAR")

                    connection.connection.commit()
                else:
                    # PostgreSQL (Supabase)
                    statements = [
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_msp BOOLEAN DEFAULT FALSE",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS parent_org_id INTEGER",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_path VARCHAR",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_webhook_url VARCHAR",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS siem_webhook_url VARCHAR",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE",
                        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP",
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP",
                        "ALTER TABLE monitored_domains ADD COLUMN IF NOT EXISTS verification_token VARCHAR"
                    ]
                    from sqlalchemy import text
                    for stmt in statements:
                        try:
                            connection.execute(text(stmt))
                        except Exception as pge:
                            logger.debug(f"PG column sync ({stmt}): {pge}")
            except Exception as e:
                logger.debug(f"Schema sync check: {e}")

        await conn.run_sync(sync_columns)

async def autonomous_scan_scheduler():
    """
    Autonomous background scheduler running every 60 minutes.
    Checks and scans domains where last_scanned_at is older than:
    - 1h for continuous scan frequency
    - 24h for daily scan frequency
    - 7d for weekly scan frequency
    - or un-scanned domains
    """
    logger.info("Autonomous domain scan scheduler initialized (interval: 60 minutes).")
    while True:
        try:
            now = datetime.utcnow()
            
            # Automated retention enforcement sweep in its own isolated session
            try:
                async with AsyncSessionLocal() as ret_session:
                    try:
                        from services.retention_service import enforce_retention_policy
                        await enforce_retention_policy(ret_session)
                        await ret_session.commit()
                    except Exception as ret_err:
                        await ret_session.rollback()
                        logger.warning(f"Automated retention enforcement error: {ret_err}")
            except Exception as e:
                logger.warning(f"Retention session connection error: {e}")

            # Autonomous domain scans
            async with AsyncSessionLocal() as session:
                try:
                    result = await session.execute(select(MonitoredDomain))
                    domains_list = result.scalars().all()

                    for domain in domains_list:
                        needs_scan = False
                        if not domain.last_scanned_at:
                            needs_scan = True
                        elif domain.scan_frequency == "continuous" and (now - domain.last_scanned_at) >= timedelta(hours=1):
                            needs_scan = True
                        elif domain.scan_frequency == "daily" and (now - domain.last_scanned_at) >= timedelta(hours=24):
                            needs_scan = True
                        elif domain.scan_frequency == "weekly" and (now - domain.last_scanned_at) >= timedelta(days=7):
                            needs_scan = True

                        if needs_scan:
                            logger.info(f"Autonomous scan running for domain: {domain.domain} (id: {domain.id})")
                            try:
                                await run_domain_scan(domain.id, session)
                                domain.last_scanned_at = datetime.utcnow()
                                await session.commit()
                            except Exception as scan_err:
                                await session.rollback()
                                logger.error(f"Autonomous scan error on {domain.domain}: {scan_err}")
                except Exception as db_err:
                    await session.rollback()
                    logger.error(f"Database query error in scan scheduler: {db_err}")

        except asyncio.CancelledError:
            logger.info("Autonomous domain scan scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"Unexpected error in scan scheduler loop: {e}")

        # Sleep for 60 minutes before next evaluation cycle
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            break

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("VERCEL"):
        try:
            os.makedirs("uploads/logos", exist_ok=True)
        except OSError:
            pass

        try:
            await init_models()
        except Exception as e:
            logger.warning(f"init_models warning: {e}")

        scheduler_task = asyncio.create_task(autonomous_scan_scheduler())
        try:
            yield
        finally:
            scheduler_task.cancel()
            try:
                await scheduler_task
            except asyncio.CancelledError:
                pass
    else:
        # Serverless environment (Vercel): zero-blocking startup
        yield

is_production = bool(
    os.environ.get("VERCEL") 
    or os.environ.get("ENVIRONMENT") == "production"
    or os.environ.get("NODE_ENV") == "production"
)
enable_docs = os.environ.get("ENABLE_DOCS", "").lower() in ("true", "1")

# Restrict OpenAPI & Swagger documentation in production environments
docs_url = "/docs" if (not is_production or enable_docs) else None
redoc_url = "/redoc" if (not is_production or enable_docs) else None
openapi_url = "/openapi.json" if (not is_production or enable_docs) else None

app = FastAPI(
    title="BreachGuard Dark Web & Exposure Monitoring API",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    lifespan=lifespan
)
application = app
handler = app

# BG-SEC-05: Strict trusted origins & secure BreachGuard Vercel deployment matching
DEFAULT_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

DEFAULT_PROD_ORIGINS = [
    "https://breachguard.vercel.app",
    "https://breachguard-w88w.vercel.app",
]

allowed_origins = list(set(DEFAULT_DEV_ORIGINS + DEFAULT_PROD_ORIGINS))

env_allowed = os.environ.get("ALLOWED_ORIGINS")
if env_allowed:
    allowed_origins.extend([orig.strip() for orig in env_allowed.split(",") if orig.strip()])

# Secure regex: allows official BreachGuard Vercel deployments and previews, while strictly rejecting arbitrary attacker subdomains
SECURE_ORIGIN_REGEX = r"^https:\/\/(breachguard|breachguard-[a-zA-Z0-9_-]+)\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=SECURE_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-BreachGuard-Signature", "Stripe-Signature", "X-API-Key"],
)

from core.redactor import SensitiveDataFilter
logging.getLogger().addFilter(SensitiveDataFilter())

@app.middleware("http")
async def add_security_headers(request, call_next):
    """
    Applies defense-in-depth HTTP security headers (Measure 29).
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(), payment=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; object-src 'none'"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response

# BG-SEC-04: Static file mount with html=False to eliminate stored XSS in uploaded content
if not os.environ.get("VERCEL"):
    try:
        os.makedirs("uploads/logos", exist_ok=True)
        app.mount("/uploads", StaticFiles(directory="uploads", html=False), name="uploads")
    except Exception as e:
        logger.debug(f"Uploads mount skipped: {e}")

# Include Core & New Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(domains.router, prefix="/api/domains", tags=["domains"])
app.include_router(exposures.router, prefix="/api/exposures", tags=["exposures"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(prospect.router, prefix="/api/prospect", tags=["prospect"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(identities.router, prefix="/api/identities", tags=["identities"])
app.include_router(integrations.router, prefix="/api/settings", tags=["settings"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(msp.router, prefix="/api/msp", tags=["msp"])
app.include_router(api_keys.router)
app.include_router(attack_surface.router)
app.include_router(email_security.router)
app.include_router(findings.router)
app.include_router(risk.router)
app.include_router(team.router, prefix="/api/team", tags=["team"])
app.include_router(cron.router, prefix="/api/cron", tags=["cron"])

from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request, exc):
    """
    Catches SQL and database exceptions to prevent leaking database tables,
    column names, or connection strings.
    """
    logger.error(f"Database error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred. The incident has been securely logged."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Catches unhandled server exceptions to prevent leaking raw tracebacks,
    filesystem paths, or third-party provider responses.
    """
    logger.error(f"Unhandled server exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact support if the issue persists."}
    )

@app.get("/")
def root():
    return {
        "status": "online",
        "platform": "BreachGuard Threat Intelligence API",
        "version": "1.0.0"
    }

@app.get("/api/health")
async def health_check():
    from core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(1))
            return {
                "status": "online",
                "database": "connected",
                "service": "BreachGuard Threat API"
            }
    except Exception as e:
        logger.error(f"Health check database connection check failed: {e}")
        return {
            "status": "degraded",
            "database": "unavailable"
        }
