"""
Shared test configuration.

Provides a single in-memory async SQLite database and dependency
override that is shared across ALL test modules. This ensures every
test file sees the same tables and session.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import StaticPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app

# ---------------------------------------------------------------------------
# Single shared in-memory async SQLite engine
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    """Dependency override providing a test database session."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Apply the dependency override once for the whole test suite
app.dependency_overrides[get_db] = override_get_db


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client():
    """Provide an async HTTP client wired to the FastAPI app."""
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )
from app.core.security import get_password_hash
from app.models.user import User
from app.models.tenant import Tenant
from app.models.membership import Membership, Role
from app.repositories.user import UserRepository
import uuid

async def create_test_user(email: str = "test@example.com", password: str = "securepassword"):
    """Helper to bypass the API and create a user directly in the test DB for auth testing."""
    async with TestSessionLocal() as session:
        repo = UserRepository(session)
        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            is_active=True,
        )
        await repo.create(user)
        await session.commit()
        return user

async def create_test_tenant_and_membership(user_id: uuid.UUID, role: Role):
    async with TestSessionLocal() as session:
        tenant = Tenant(name=f"Tenant for {user_id}")
        session.add(tenant)
        await session.flush()
        await session.refresh(tenant)

        membership = Membership(
            user_id=user_id,
            tenant_id=tenant.id,
            role=role,
        )
        session.add(membership)
        await session.commit()
        return tenant, membership
