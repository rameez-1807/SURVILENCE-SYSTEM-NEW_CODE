import asyncio
import uuid
import bcrypt
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.db.session import engine
from app.db.base import Base
from app.models import (  # noqa: F401
    Tenant, Site, User, Membership, Camera, Employee, 
    AttendanceRecord, Event, Rule, VehicleRecord, 
    RecognitionHistory, DetectionZone
)
from sqlalchemy import text


async def init_db_and_seed():
    print("[*] Creating all database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables created successfully!")

    print("[*] Performing clean atomic seed of Tenant, Admin User & Platform Admin Membership...")
    async with engine.begin() as conn:
        try:
            # Disable foreign keys to cleanly eliminate any legacy truncated/corrupted records
            await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            await conn.execute(text("DELETE FROM memberships;"))
            await conn.execute(text("DELETE FROM users;"))
            await conn.execute(text("DELETE FROM tenants;"))
            
            # Pure 32-character hexadecimal UUIDs (exact match for MySQL CHAR(32))
            tenant_id = uuid.uuid4().hex
            user_id = uuid.uuid4().hex
            membership_id = uuid.uuid4().hex
            
            password = 'admin123'
            salt = bcrypt.gensalt()
            hashed_pwd = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
            
            # Direct atomic inserts
            await conn.execute(
                text("INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (:id, :name, :status, NOW(), NOW())"),
                {"id": tenant_id, "name": "Default Organization", "status": "active"}
            )
            print(f"[+] Clean Tenant created with 32-hex ID: {tenant_id}")
            
            await conn.execute(
                text("INSERT INTO users (id, email, hashed_password, is_active, created_at, updated_at) VALUES (:id, :email, :pwd, 1, NOW(), NOW())"),
                {"id": user_id, "email": "admin@example.com", "pwd": hashed_pwd}
            )
            print(f"[+] Clean Admin user created: admin@example.com with 32-hex ID: {user_id}")
            
            await conn.execute(
                text("INSERT INTO memberships (id, user_id, tenant_id, role, created_at, updated_at) VALUES (:id, :uid, :tid, :role, NOW(), NOW())"),
                {"id": membership_id, "uid": user_id, "tid": tenant_id, "role": "platform_admin"}
            )
            print(f"[+] Clean Platform Admin Membership linked (Role: platform_admin)")
            
            await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            print("[+] DATABASE SEEDING COMPLETED SUCCESSFULLY!")
        except Exception as e:
            # Fallback for SQLite / PostgreSQL where FOREIGN_KEY_CHECKS is not MySQL-specific
            print(f"[!] MySQL-specific note: {e}, running standard fallback...")
            try:
                await conn.execute(text("DELETE FROM memberships;"))
                await conn.execute(text("DELETE FROM users;"))
                await conn.execute(text("DELETE FROM tenants;"))
                tenant_id = uuid.uuid4().hex
                user_id = uuid.uuid4().hex
                membership_id = uuid.uuid4().hex
                password = 'admin123'
                salt = bcrypt.gensalt()
                hashed_pwd = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
                await conn.execute(
                    text("INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (:id, :name, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"),
                    {"id": tenant_id, "name": "Default Organization", "status": "active"}
                )
                await conn.execute(
                    text("INSERT INTO users (id, email, hashed_password, is_active, created_at, updated_at) VALUES (:id, :email, :pwd, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"),
                    {"id": user_id, "email": "admin@example.com", "pwd": hashed_pwd}
                )
                await conn.execute(
                    text("INSERT INTO memberships (id, user_id, tenant_id, role, created_at, updated_at) VALUES (:id, :uid, :tid, :role, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"),
                    {"id": membership_id, "uid": user_id, "tid": tenant_id, "role": "platform_admin"}
                )
                print("[+] Fallback seeding completed successfully!")
            except Exception as ex2:
                print(f"[!] Fallback seed error: {ex2}")


if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
