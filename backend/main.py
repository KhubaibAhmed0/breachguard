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
    identities, integrations, msp
)

logger = logging.getLogger(__name__)

# Ensure tables and dynamic columns exist
async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def sync_sqlite_columns(connection):
            try:
                if "sqlite" in str(connection.engine.url):
                    cursor = connection.connection.cursor()
                    cursor.execute("PRAGMA table_info(organizations)")
                    cols = [r[1] for r in cursor.fetchall()]
                    needed_cols = [
                        ("is_msp", "BOOLEAN DEFAULT 0"),
                        ("parent_org_id", "INTEGER"),
                        ("logo_path", "VARCHAR"),
                        ("slack_webhook_url", "VARCHAR"),
                        ("siem_webhook_url", "VARCHAR"),
                        ("is_trial", "BOOLEAN DEFAULT 0"),
                        ("trial_ends_at", "DATETIME"),
                    ]
                    for c_name, c_def in needed_cols:
                        if c_name not in cols:
                            cursor.execute(f"ALTER TABLE organizations ADD COLUMN {c_name} {c_def}")
                    connection.connection.commit()
            except Exception as e:
                logger.debug(f"Schema sync check: {e}")

        await conn.run_sync(sync_sqlite_columns)

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
            async with AsyncSessionLocal() as session:
                # Automated retention enforcement sweep
                try:
                    from services.retention_service import enforce_retention_policy
                    await enforce_retention_policy(session)
                except Exception as ret_err:
                    logger.error(f"Automated retention enforcement error: {ret_err}")

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
                            logger.error(f"Autonomous scan error on {domain.domain}: {scan_err}")

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

# Trusted frontend origins (Measure 28)
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

env_allowed = os.environ.get("ALLOWED_ORIGINS")
if env_allowed:
    allowed_origins = [orig.strip() for orig in env_allowed.split(",") if orig.strip()]
elif is_production:
    allowed_origins = DEFAULT_PROD_ORIGINS
else:
    allowed_origins = DEFAULT_DEV_ORIGINS + DEFAULT_PROD_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-BreachGuard-Signature", "Stripe-Signature"],
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
    if is_production or request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response

# Static file mount (safely skipped in serverless read-only mode)
if not os.environ.get("VERCEL"):
    try:
        os.makedirs("uploads/logos", exist_ok=True)
        app.mount("/uploads", StaticFiles(directory="uploads", html=True), name="uploads")
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
app.include_router(msp.router, prefix="/api/msp", tags=["msp"])

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
