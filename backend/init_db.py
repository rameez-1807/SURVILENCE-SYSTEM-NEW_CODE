import asyncio
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
from scripts.repair_and_backup_mysql import main as run_safe_repair


async def init_db_and_seed():
    print("[*] Ensuring all database tables exist...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables checked/created successfully!")

    print("[*] Running non-destructive backup and safe UUID repair (preserving all existing data)...")
    run_safe_repair()


if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
