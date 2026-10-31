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
from sqlalchemy import select, delete, text

async def init_db_and_seed():
    print("[*] Creating all database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables created successfully!")

    print("[*] Resetting stale auth records cleanly...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            await conn.execute(text("DELETE FROM memberships;"))
            await conn.execute(text("DELETE FROM users WHERE email = 'admin@example.com';"))
            await conn.execute(text("DELETE FROM tenants WHERE name = 'Default Organization';"))
            await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        except Exception as e:
            print(f"[!] Clean note: {e}")

    # Cleanly synchronize admin, tenant, and membership
    async with async_session_factory() as session:
        password = 'admin123'
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        now = datetime.now(timezone.utc)

        tenant_id = uuid.uuid4()
        user_id = uuid.uuid4()
        membership_id = uuid.uuid4()

        print("[*] Creating clean default tenant...")
        tenant = Tenant(
            id=tenant_id,
            name="Default Organization",
            status=TenantStatus.ACTIVE,
            created_at=now,
            updated_at=now
        )
        session.add(tenant)
        await session.flush()

        print("[*] Creating clean admin user (admin@example.com / admin123)...")
        admin_user = User(
            id=user_id,
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
            id=membership_id,
            user_id=user_id,
            tenant_id=tenant_id,
            role=Role.PLATFORM_ADMIN,
            created_at=now,
            updated_at=now
        )
        session.add(membership)

        await session.commit()
        print("[+] Admin user, tenant, and membership created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
