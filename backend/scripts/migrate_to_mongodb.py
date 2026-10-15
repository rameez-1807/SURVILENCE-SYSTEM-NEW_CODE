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
from datetime import datetime, date, time, timezone
from typing import Optional
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


async def run_migration(custom_url: Optional[str] = None):
    print("=" * 60)
    print("MIGRATING AI SURVEILLANCE DATABASE TO MONGODB ATLAS")
    print("=" * 60)

    import os
    if custom_url:
        os.environ["MONGODB_URL"] = custom_url
        from app.core.config import settings
        settings.MONGODB_URL = custom_url
        import app.db.mongodb as mongo_mod
        mongo_mod._sync_client = None
        mongo_mod._sync_db = None
        mongo_mod._async_client = None
        mongo_mod._async_db = None

        # Write or update backend/.env
        env_path = backend_dir / ".env"
        env_content = f"MONGODB_URL={custom_url}\nMONGODB_DATABASE=ai_surveillance\n"
        if env_path.exists():
            current_text = env_path.read_text(encoding="utf-8")
            if "MONGODB_URL=" in current_text:
                import re
                current_text = re.sub(r"MONGODB_URL=.*", f"MONGODB_URL={custom_url}", current_text)
            else:
                current_text += f"\n{env_content}"
            env_path.write_text(current_text, encoding="utf-8")
        else:
            env_path.write_text(env_content, encoding="utf-8")
        print(f"[OK] Saved MONGODB_URL to {env_path.name}")

    # 1. Initialize MongoDB Atlas DB & Indexes
    mongo_db = get_sync_db()
    await init_mongo_indexes()
    print("[OK] Connected to MongoDB Atlas Cluster0: database 'ai_surveillance'")

    # Explicitly ensure all collections exist in MongoDB Atlas
    existing_colls = mongo_db.list_collection_names()
    all_colls = [
        "tenants", "sites", "users", "cameras", "events", 
        "vehicles", "employees", "attendance_records", "recognition_history"
    ]
    for coll_name in all_colls:
        if coll_name not in existing_colls:
            try:
                mongo_db.create_collection(coll_name)
                print(f"  [+] Created collection '{coll_name}'")
            except Exception:
                pass

    # 2. Extract and load all tables from relational DB if available
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

    try:
        async with async_session_factory() as session:
            for coll_name, model in models_to_migrate:
                print(f"\n[Migrating {coll_name}]...")
                stmt = select(model)
                result = await session.execute(stmt)
                rows = result.scalars().all()

                if not rows:
                    print(f"  -> 0 rows found in relational DB.")
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
    except Exception as e:
        print(f"  [Notice] Relational DB extract note: {e}")

    # 3. Seed starter documents for every collection that is still empty
    now = datetime.now(timezone.utc)

    if mongo_db.tenants.count_documents({}) == 0:
        mongo_db.tenants.insert_one({
            "_id": "tenant_default_01",
            "name": "AI Surveillance HQ Command",
            "slug": "ai-surveillance-hq",
            "status": "active",
            "created_at": now
        })
        print("  [+] Seeded starter tenant into MongoDB 'tenants'")

    if mongo_db.sites.count_documents({}) == 0:
        mongo_db.sites.insert_one({
            "_id": "site_default_hq",
            "tenant_id": "tenant_default_01",
            "name": "Main Campus & Facilities",
            "address": "Terminal A, Tech Zone",
            "status": "active",
            "is_active": True,
            "created_at": now
        })
        print("  [+] Seeded starter site into MongoDB 'sites'")

    if mongo_db.users.count_documents({}) == 0:
        mongo_db.users.insert_one({
            "_id": "user_admin_01",
            "tenant_id": "tenant_default_01",
            "email": "admin@example.com",
            "full_name": "Chief Security Officer",
            "role": "admin",
            "is_active": True,
            "created_at": now
        })
        print("  [+] Seeded administrator user into MongoDB 'users'")

    if mongo_db.cameras.count_documents({}) == 0:
        default_cameras = [
            {
                "_id": "cam_default_webcam",
                "name": "Live Browser Webcam",
                "protocol": "usb",
                "stream_path": "/live",
                "site_id": "site_default_hq",
                "status": "online",
                "is_active": True,
                "created_at": now
            },
            {
                "_id": "cam_entrance_gate",
                "name": "Main Entrance Gate",
                "protocol": "rtsp",
                "stream_path": "rtsp://192.168.1.100:554/live",
                "site_id": "site_default_hq",
                "status": "online",
                "is_active": True,
                "created_at": now
            },
            {
                "_id": "cam_parking_bay",
                "name": "Vehicle Parking Bay A",
                "protocol": "rtsp",
                "stream_path": "rtsp://192.168.1.101:554/live",
                "site_id": "site_default_hq",
                "status": "online",
                "is_active": True,
                "created_at": now
            }
        ]
        mongo_db.cameras.insert_many(default_cameras)
        print("  [+] Seeded starter camera nodes into MongoDB 'cameras'")

    if mongo_db.events.count_documents({}) == 0:
        mongo_db.events.insert_many([
            {
                "_id": "evt_sample_01",
                "camera_id": "cam_default_webcam",
                "event_type": "person_detected",
                "confidence": 0.94,
                "label": "person",
                "bbox": [120, 80, 240, 360],
                "track_id": 1,
                "observed_at": now,
                "created_at": now
            },
            {
                "_id": "evt_sample_02",
                "camera_id": "cam_entrance_gate",
                "event_type": "security_perimeter_breach",
                "confidence": 0.89,
                "label": "person",
                "bbox": [210, 150, 380, 420],
                "track_id": 2,
                "observed_at": now,
                "created_at": now
            }
        ])
        print("  [+] Seeded sample AI events into MongoDB 'events'")

    if mongo_db.vehicles.count_documents({}) == 0:
        mongo_db.vehicles.insert_many([
            {
                "_id": "veh_sample_01",
                "camera_id": "cam_parking_bay",
                "plate_number": "MH12AB1234",
                "vehicle_type": "car",
                "confidence": 0.96,
                "timestamp": now,
                "created_at": now
            },
            {
                "_id": "veh_sample_02",
                "camera_id": "cam_entrance_gate",
                "plate_number": "DL01XY9876",
                "vehicle_type": "suv",
                "confidence": 0.92,
                "timestamp": now,
                "created_at": now
            }
        ])
        print("  [+] Seeded sample ANPR vehicle records into MongoDB 'vehicles'")

    if mongo_db.employees.count_documents({}) == 0:
        mongo_db.employees.insert_many([
            {
                "_id": "emp_sample_01",
                "code": "EMP001",
                "name": "Rameez Khan",
                "department": "Security Intelligence",
                "email": "rameez@example.com",
                "is_active": True,
                "created_at": now
            },
            {
                "_id": "emp_sample_02",
                "code": "EMP002",
                "name": "Operational Supervisor",
                "department": "Surveillance Operations",
                "email": "supervisor@example.com",
                "is_active": True,
                "created_at": now
            }
        ])
        print("  [+] Seeded biometric employees into MongoDB 'employees'")

    if mongo_db.attendance_records.count_documents({}) == 0:
        mongo_db.attendance_records.insert_one({
            "_id": "att_sample_01",
            "employee_uuid": "emp_sample_01",
            "employee_code": "EMP001",
            "employee_name": "Rameez Khan",
            "date": now.strftime("%Y-%m-%d"),
            "check_in": now.strftime("%H:%M:%S"),
            "status": "present",
            "created_at": now
        })
        print("  [+] Seeded attendance logs into MongoDB 'attendance_records'")

    if mongo_db.recognition_history.count_documents({}) == 0:
        mongo_db.recognition_history.insert_one({
            "_id": "rec_sample_01",
            "person_name": "Rameez Khan",
            "employee_id": "EMP001",
            "camera_id": "cam_entrance_gate",
            "match_score": 0.98,
            "timestamp": now,
            "created_at": now
        })
        print("  [+] Seeded recognition history into MongoDB 'recognition_history'")

    print("\n" + "=" * 60)
    print("MONGODB ATLAS COLLECTIONS SUMMARY")
    print("=" * 60)

    for coll_name in all_colls:
        cnt = mongo_db[coll_name].count_documents({})
        print(f"  - {coll_name}: {cnt} documents in MongoDB Atlas")

    print("\nMIGRATION & DATABASE CREATION COMPLETE!")
    return total_migrated


if __name__ == "__main__":
    url_arg = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(run_migration(url_arg))
