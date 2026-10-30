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
from sqlalchemy import select

async def init_db_and_seed():
    print("[*] Creating all database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables created successfully!")

    # Seed admin user and tenant via SQLAlchemy async session
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == "admin@example.com"))
        existing_user = result.scalar_one_or_none()
        if existing_user:
            print("[+] Admin user already exists.")
            return

        print("[*] Creating admin user (admin@example.com / admin123)...")
        password = 'admin123'
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

        tenant_id = uuid.UUID('bb398bec-8429-44db-b9ec-b04c3ac81c36')
        user_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        # Check tenant
        tenant_res = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_res.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(
                id=tenant_id,
                name="Default Organization",
                status=TenantStatus.ACTIVE,
                created_at=now,
                updated_at=now
            )
            session.add(tenant)

        # Add user
        user = User(
            id=user_id,
            email="admin@example.com",
            hashed_password=hashed,
            is_active=True,
            created_at=now,
            updated_at=now
        )
        session.add(user)

        # Add membership
        membership = Membership(
            id=uuid.uuid4(),
            user_id=user_id,
            tenant_id=tenant_id,
            role="platform_admin",
            created_at=now,
            updated_at=now
        )
        session.add(membership)

        await session.commit()
        print("[+] Database initialized and admin user created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
