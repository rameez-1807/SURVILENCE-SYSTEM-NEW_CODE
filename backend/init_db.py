import asyncio
import sqlite3
import uuid
import bcrypt
from datetime import datetime, timezone
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

async def init_db_and_seed():
    print("[*] Creating all database tables in SQLite...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables created successfully!")

    # Now seed admin user using sqlite3 directly
    db_file = backend_dir / "ai_surveillance.db"
    conn = sqlite3.connect(str(db_file))
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", ('admin@example.com',))
    if cursor.fetchone():
        print("[+] Admin user already exists.")
        conn.close()
        return

    print("[*] Creating admin user (admin@example.com / admin123)...")
    password = 'admin123'
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    tenant_id = uuid.UUID('bb398bec-8429-44db-b9ec-b04c3ac81c36').hex
    user_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT id FROM tenants WHERE id = ?", (tenant_id,))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (tenant_id, 'Default Organization', 'active', now, now)
        )

    cursor.execute(
        "INSERT INTO users (id, email, hashed_password, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, 'admin@example.com', hashed, 1, now, now)
    )

    membership_id = uuid.uuid4().hex
    cursor.execute(
        "INSERT INTO memberships (id, user_id, tenant_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (membership_id, user_id, tenant_id, 'platform_admin', now, now)
    )

    conn.commit()
    conn.close()
    print("[+] Database initialized and admin user created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db_and_seed())

