"""
AI Surveillance System - Database Engine & Session

Configures async SQLAlchemy engine and session factory.
Optimized for Neon PostgreSQL with connection pooling.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Detect if using Neon/PostgreSQL or SQLite
_is_postgres = settings.DATABASE_URL.startswith("postgresql")

# Async engine - optimized for Neon PostgreSQL
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,          # Detect stale connections automatically
    pool_size=5 if _is_postgres else 1,          # Neon free tier: keep small
    max_overflow=10 if _is_postgres else 0,      # Extra connections on demand
    pool_recycle=300,            # Recycle connections every 5 min (Neon idle timeout)
    connect_args={"ssl": "require"} if _is_postgres else {},  # SSL required for Neon
)

# Async session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
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
