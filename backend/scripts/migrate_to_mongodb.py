"""
AI Surveillance System - Complete Data Migration to MongoDB Atlas

Reads all existing records from PostgreSQL/Supabase:
  - tenants
  - sites
  - users
  - cameras
  - events (289+)
  - vehicle_records (48+)
  - employees (15+)
  - attendance_records (4+)
  - recognition_history (2+)

And migrates them cleanly into MongoDB Atlas under database 'ai_surveillance'.
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, date, time
import uuid

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.db.session import async_session_factory
from app.db.mongodb import get_sync_db, init_mongo_indexes

# Models
from app.models.tenant import Tenant
from app.models.site import Site
from app.models.user import User
from app.models.camera import Camera
from app.models.event import Event
from app.models.vehicle import VehicleRecord
from app.models.employee import Employee
from app.models.attendance import AttendanceRecord
from app.models.recognition_history import RecognitionHistory


def serialize_val(v):
    """Serialize UUIDs, dates, and times for MongoDB."""
    if isinstance(v, uuid.UUID):
        return str(v)
    elif isinstance(v, datetime):
        return v
    elif isinstance(v, (date, time)):
        return str(v)
    return v


def row_to_dict(row):
    """Convert an SQLAlchemy model instance into a clean dict for MongoDB."""
    d = {}
    for column in row.__table__.columns:
        val = getattr(row, column.name)
        d[column.name] = serialize_val(val)
    # Ensure primary key _id is set to id string if available
    if "id" in d and d["id"] is not None:
        d["_id"] = str(d["id"])
    return d


async def run_migration():
    print("=" * 60)
    print("MIGRATING AI SURVEILLANCE DATABASE TO MONGODB ATLAS")
    print("=" * 60)

    # 1. Initialize MongoDB Atlas DB & Indexes
    mongo_db = get_sync_db()
    await init_mongo_indexes()
    print("[OK] Connected to MongoDB Atlas Cluster0: database 'ai_surveillance'")

    # 2. Extract and load all tables
    models_to_migrate = [
        ("tenants", Tenant),
        ("sites", Site),
        ("users", User),
        ("cameras", Camera),
        ("events", Event),
        ("vehicles", VehicleRecord),
        ("employees", Employee),
        ("attendance_records", AttendanceRecord),
        ("recognition_history", RecognitionHistory),
    ]

    total_migrated = 0

    async with async_session_factory() as session:
        for coll_name, model in models_to_migrate:
            print(f"\n[Migrating {coll_name}]...")
            stmt = select(model)
            result = await session.execute(stmt)
            rows = result.scalars().all()

            if not rows:
                print(f"  -> 0 rows found in PostgreSQL. Skipped.")
                continue

            documents = [row_to_dict(r) for r in rows]

            # Upsert into MongoDB
            collection = mongo_db[coll_name]
            inserted_count = 0

            for doc in documents:
                doc_id = doc.get("_id")
                if doc_id:
                    collection.replace_one({"_id": doc_id}, doc, upsert=True)
                else:
                    collection.insert_one(doc)
                inserted_count += 1

            total_migrated += inserted_count
            print(f"  [OK] {inserted_count} documents successfully stored in MongoDB '{coll_name}' collection!")

    print("\n" + "=" * 60)
    print("MONGODB ATLAS VERIFICATION")
    print("=" * 60)

    for coll_name, _ in models_to_migrate:
        cnt = mongo_db[coll_name].count_documents({})
        print(f"  - {coll_name}: {cnt} documents in MongoDB Atlas")

    print("\nMIGRATION COMPLETE! Total documents migrated:", total_migrated)
    return total_migrated


if __name__ == "__main__":
    asyncio.run(run_migration())
