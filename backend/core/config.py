from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Dark Web Monitor"
    DATABASE_URL: str = "sqlite+aiosqlite:///./darkweb.db"
    SECRET_KEY: str = "supersecretkey"
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
    
    class Config:
        env_file = ".env"

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
