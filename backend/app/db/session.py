"""
AI Surveillance System - Database Engine & Session

Configures async SQLAlchemy engine and session factory.
Supports both local SQLite and Supabase PostgreSQL (via PgBouncer pooler).
"""

from typing import Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Detect if using PostgreSQL, MySQL, or SQLite
_db_url = settings.DATABASE_URL
_is_postgres = _db_url.startswith("postgresql")
_is_mysql = _db_url.startswith("mysql")

# Build engine kwargs based on backend
_engine_kwargs: dict[str, Any] = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,  # Detect stale connections automatically
}

if _is_postgres:
    _engine_kwargs.update({
        "pool_size": 5,              # Keep small for Supabase free tier
        "max_overflow": 10,          # Extra connections on demand
        "pool_recycle": 300,         # Recycle every 5 min (idle timeout)
        "connect_args": {
            "ssl": "require",
            # PgBouncer transaction-mode doesn't support prepared statements.
            # asyncpg uses them by default, so we must disable statement_cache_size.
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    })
elif _is_mysql:
    _engine_kwargs.update({
        "pool_size": 5,
        "max_overflow": 10,
        "pool_recycle": 60,         # Recycle connections every 60s to prevent Hostinger idle disconnects
        "pool_pre_ping": True,       # Auto-detect dropped sockets
        "connect_args": {
            "connect_timeout": 15,
        },
    })
else:
    from sqlalchemy.pool import NullPool
    _engine_kwargs.update({
        "poolclass": NullPool,
        "connect_args": {
            "timeout": 30.0,
            "check_same_thread": False,
        },
    })

# Async engine
engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# Async session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides an async database session.

    Usage in FastAPI:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
