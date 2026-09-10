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

app = FastAPI(
    title="BreachGuard Dark Web & Exposure Monitoring API",
    version="1.0.0",
    lifespan=lifespan
)
application = app
handler = app

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    from models.user import User
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User))
            users = [u.email for u in result.scalars().all()]
            host = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "sqlite_default"
            return {
                "status": "online",
                "connected_db": host,
                "user_count": len(users),
                "users": users
            }
    except Exception as e:
        return {"status": "db_error", "error": str(e)}
