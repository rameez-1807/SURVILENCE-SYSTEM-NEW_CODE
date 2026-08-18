import asyncio
import uuid
from app.db.session import async_session_factory
from app.models.user import User
from app.models.tenant import Tenant
from app.models.membership import Membership, Role
from app.core.security import get_password_hash
from sqlalchemy import select

async def seed_db():
    print("Seeding database...")
    async with async_session_factory() as session:
        # Check if admin exists
        result = await session.execute(select(User).where(User.email == "admin@example.com"))
        admin = result.scalar_one_or_none()
        
        if admin:
            print("Admin user already exists.")
            return

        print("Creating default tenant...")
        tenant = Tenant(
            id=uuid.UUID('bb398bec-8429-44db-b9ec-b04c3ac81c36'),
            name="Default Organization"
        )
        session.add(tenant)

        print("Creating admin user (admin@example.com / admin123)...")
        admin = User(
            id=uuid.uuid4(),
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            is_active=True
        )
        session.add(admin)

        print("Creating membership...")
        membership = Membership(
            id=uuid.uuid4(),
            user_id=admin.id,
            tenant_id=tenant.id,
            role=Role.PLATFORM_ADMIN
        )
        session.add(membership)

        await session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_db())
