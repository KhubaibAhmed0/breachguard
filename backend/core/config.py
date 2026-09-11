import os
import secrets
import logging
from pydantic_settings import BaseSettings
from typing import Optional, Set

logger = logging.getLogger("breachguard.config")

KNOWN_INSECURE_SECRETS: Set[str] = {
    "supersecretkey",
    "supersecretkey_breachguard_2026",
    "secret",
    "changeme",
    "password",
    "12345678",
    "admin",
    "testsecret",
    "defaultsecret",
}

class Settings(BaseSettings):
    PROJECT_NAME: str = "BreachGuard Threat Intelligence"
    DATABASE_URL: str = "sqlite+aiosqlite:///./darkweb.db"
    ENVIRONMENT: str = "development"
    SECRET_KEY: Optional[str] = None
    WEBHOOK_SIGNING_KEY: Optional[str] = None
    TRUSTED_PROXIES: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    HIBP_API_KEY: Optional[str] = None
    LEAKCHECK_API_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    REDIS_URL: str = "redis://localhost:6379/0"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None
    FROM_EMAIL: str = "security@breachguard.io"
    FRONTEND_URL: str = "http://localhost:3000"
    CRON_SECRET: Optional[str] = None
    
    class Config:
        env_file = ".env"
        extra = "ignore"

    def validate_production_keys(self):
        is_prod = (
            self.ENVIRONMENT.lower() == "production"
            or bool(os.environ.get("VERCEL"))
            or os.environ.get("NODE_ENV") == "production"
        )
        
        # BG-SEC-01: Strict production fail-closed verification
        if is_prod:
            if not self.SECRET_KEY:
                raise RuntimeError(
                    "FATAL CONFIGURATION ERROR: SECRET_KEY environment variable is required in production."
                )
            if len(self.SECRET_KEY) < 32:
                raise RuntimeError(
                    "FATAL CONFIGURATION ERROR: Production SECRET_KEY must be at least 32 characters (256 bits) long."
                )
            if self.SECRET_KEY.lower().strip() in KNOWN_INSECURE_SECRETS:
                raise RuntimeError(
                    "FATAL CONFIGURATION ERROR: Production SECRET_KEY cannot be a known weak or default secret."
                )
        return True

    def model_post_init(self, __context):
        is_prod = (
            self.ENVIRONMENT.lower() == "production"
            or bool(os.environ.get("VERCEL"))
            or os.environ.get("NODE_ENV") == "production"
        )
        if is_prod:
            self.validate_production_keys()
        else:
            # Development fallback with high-entropy ephemeral key if unset or weak
            if not self.SECRET_KEY or self.SECRET_KEY.lower().strip() in KNOWN_INSECURE_SECRETS:
                logger.warning(
                    "[SECURITY WARNING] SECRET_KEY is unset or using a weak default. "
                    "A secure ephemeral 256-bit key has been generated for this session."
                )
                self.SECRET_KEY = secrets.token_hex(32)

        # BG-SEC-03: Isolated webhook signing key fallback
        if not self.WEBHOOK_SIGNING_KEY:
            self.WEBHOOK_SIGNING_KEY = secrets.token_hex(32)

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Automatic IPv4 Pooler routing for Supabase on IPv4-only cloud platforms (like Vercel)
        if "db.eqcpazrhhplewwzjnxod.supabase.co" in url:
            url = url.replace("db.eqcpazrhhplewwzjnxod.supabase.co:5432", "aws-0-ap-southeast-1.pooler.supabase.com:5432")
            url = url.replace("db.eqcpazrhhplewwzjnxod.supabase.co", "aws-0-ap-southeast-1.pooler.supabase.com:5432")
            if "postgres:" in url and "postgres.eqcpazrhhplewwzjnxod" not in url:
                url = url.replace("postgres:", "postgres.eqcpazrhhplewwzjnxod:", 1)
        return url

settings = Settings()

