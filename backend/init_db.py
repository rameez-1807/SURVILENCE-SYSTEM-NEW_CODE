import asyncio
import uuid
import bcrypt
from datetime import datetime, timezone
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.db.session import engine, async_session_factory
from app.db.base import Base
from app.models import (  # noqa: F401
    Tenant, Site, User, Membership, Camera, Employee, 
    AttendanceRecord, Event, Rule, VehicleRecord, 
    RecognitionHistory, DetectionZone
)
from app.models.tenant import TenantStatus
from app.models.membership import Role
from sqlalchemy import select, delete

async def init_db_and_seed():
    print("[*] Creating all database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables created successfully!")

    # Cleanly synchronize admin, tenant, and membership
    async with async_session_factory() as session:
        password = 'admin123'
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        now = datetime.now(timezone.utc)

        print("[*] Cleaning up any stale admin/membership rows...")
        await session.execute(delete(Membership).where(Membership.role == Role.PLATFORM_ADMIN))
        await session.execute(delete(User).where(User.email == "admin@example.com"))

        # Check or create default tenant
        tenant_res = await session.execute(
            select(Tenant).where(Tenant.name == "Default Organization")
        )
        tenant = tenant_res.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(
                id=uuid.uuid4(),
                name="Default Organization",
                status=TenantStatus.ACTIVE,
                created_at=now,
                updated_at=now
            )
            session.add(tenant)
            await session.flush()

        print("[*] Creating clean admin user (admin@example.com / admin123)...")
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@example.com",
            hashed_password=hashed,
            is_active=True,
            created_at=now,
            updated_at=now
        )
        session.add(admin_user)
        await session.flush()

        print("[*] Creating platform_admin membership...")
        membership = Membership(
            id=uuid.uuid4(),
            user_id=admin_user.id,
            tenant_id=tenant.id,
            role=Role.PLATFORM_ADMIN,
            created_at=now,
            updated_at=now
        )
        session.add(membership)

        await session.commit()
        print("[+] Database initialized and admin user created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
