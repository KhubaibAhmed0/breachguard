from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from core.config import settings
from typing import AsyncGenerator

db_url = settings.async_database_url
connect_args = {}
engine_kwargs = {"echo": False}

if "sqlite" in db_url:
    connect_args["check_same_thread"] = False
else:
    connect_args["prepared_statement_cache_size"] = 0
    connect_args["command_timeout"] = 15
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10
    })

engine = create_async_engine(db_url, connect_args=connect_args, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
