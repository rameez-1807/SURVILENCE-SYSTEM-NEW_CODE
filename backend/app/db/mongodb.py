"""
AI Surveillance System - MongoDB Atlas Cloud Database Engine

Manages async (Motor) and sync (PyMongo) connections to MongoDB Atlas Cluster.
Provides collections for:
  - events (Security & Object Detections with ByteTrack IDs)
  - vehicles (ANPR License Plate Scans & Records)
  - employees (Biometric facial recognition registrations)
  - attendance_records (Check-in/check-out logs)
  - cameras (RTSP / USB Video sources)
  - sites & tenants (Facility definitions)
  - recognition_history (Historical recognition audits)
"""

import logging
from typing import Optional, Dict, Any
from pymongo import MongoClient  # type: ignore
from pymongo.collection import Collection  # type: ignore
from pymongo.database import Database  # type: ignore
import motor.motor_asyncio  # type: ignore

from app.core.config import settings

logger = logging.getLogger(__name__)

# Async Motor Client & DB
_async_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_async_db: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None

# Sync PyMongo Client & DB
_sync_client: Optional[MongoClient] = None
_sync_db: Optional[Database] = None


def get_async_mongo_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    """Get or initialize the async Motor client."""
    global _async_client
    if _async_client is None:
        url = getattr(settings, "MONGODB_URL", "")
        if not url:
            raise ValueError("MONGODB_URL is not configured in settings.")
        logger.info("[MongoDB] Initializing async Motor client...")
        try:
            import certifi
            ca_file = certifi.where()
        except ImportError:
            ca_file = None

        kwargs: Dict[str, Any] = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 5000,
        }
        if ca_file:
            kwargs["tlsCAFile"] = ca_file

        _async_client = motor.motor_asyncio.AsyncIOMotorClient(url, **kwargs)
    return _async_client


def get_async_db() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    """Get the async MongoDB database instance."""
    global _async_db
    if _async_db is None:
        client = get_async_mongo_client()
        db_name = getattr(settings, "MONGODB_DATABASE", "ai_surveillance")
        _async_db = client[db_name]
    return _async_db


def get_sync_mongo_client() -> MongoClient:
    """Get or initialize the sync PyMongo client."""
    global _sync_client
    if _sync_client is None:
        url = getattr(settings, "MONGODB_URL", "")
        if not url:
            raise ValueError("MONGODB_URL is not configured in settings.")
        try:
            import certifi
            ca_file = certifi.where()
        except ImportError:
            ca_file = None

        kwargs: Dict[str, Any] = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 5000,
        }
        if ca_file:
            kwargs["tlsCAFile"] = ca_file

        _sync_client = MongoClient(url, **kwargs)
    return _sync_client


def get_sync_db() -> Database:
    """Get the sync PyMongo database instance."""
    global _sync_db
    if _sync_db is None:
        client = get_sync_mongo_client()
        db_name = getattr(settings, "MONGODB_DATABASE", "ai_surveillance")
        _sync_db = client[db_name]
    return _sync_db


async def init_mongo_indexes() -> None:
    """
    Initialize indexes on MongoDB Atlas collections for high-speed queries.
    Safe and idempotent.
    """
    if not getattr(settings, "MONGODB_URL", ""):
        logger.info("[MongoDB] MONGODB_URL is not configured; running without MongoDB Atlas.")
        return

    try:
        db = get_async_db()

        # 1. Events collection indexes (with tenant isolation)
        await db.events.create_index([("tenant_id", 1), ("observed_at", -1)])
        await db.events.create_index([("tenant_id", 1), ("event_type", 1)])
        await db.events.create_index([("tenant_id", 1), ("camera_id", 1)])
        await db.events.create_index([("observed_at", -1)])
        await db.events.create_index([("event_type", 1)])
        await db.events.create_index([("track_id", 1)])
        await db.events.create_index([("dedupe_key", 1)])
        await db.events.create_index([("camera_id", 1)])

        # 2. Vehicles collection indexes (with tenant isolation)
        await db.vehicles.create_index([("tenant_id", 1), ("timestamp", -1)])
        await db.vehicles.create_index([("tenant_id", 1), ("number_plate", 1)])
        await db.vehicles.create_index([("timestamp", -1)])
        await db.vehicles.create_index([("number_plate", 1)])

        # 3. Employees collection indexes (with tenant isolation)
        await db.employees.create_index([("tenant_id", 1), ("employee_id", 1)])
        await db.employees.create_index([("employee_id", 1)])
        await db.employees.create_index([("code", 1)])
        await db.employees.create_index([("email", 1)])

        # 4. Attendance records collection indexes (with tenant isolation)
        await db.attendance_records.create_index([("tenant_id", 1), ("date", -1)])
        await db.attendance_records.create_index([("tenant_id", 1), ("employee_uuid", 1)])
        await db.attendance_records.create_index([("date", -1)])
        await db.attendance_records.create_index([("employee_uuid", 1)])

        # 5. Recognition history collection indexes (with tenant isolation)
        await db.recognition_history.create_index([("tenant_id", 1), ("timestamp", -1)])

        # 6. Cameras collection indexes
        await db.cameras.create_index([("tenant_id", 1), ("id", 1)])
        await db.cameras.create_index([("id", 1)])

        logger.info("[MongoDB] Atlas collections & indexes successfully verified.")
    except Exception as e:
        logger.warning(f"[MongoDB] Could not initialize indexes: {e}")


def close_mongo_connections() -> None:
    """Close MongoDB connections cleanly during shutdown."""
    global _async_client, _async_db, _sync_client, _sync_db
    if _async_client is not None:
        _async_client.close()
        _async_client = None
        _async_db = None
    if _sync_client is not None:
        _sync_client.close()
        _sync_client = None
        _sync_db = None
    logger.info("[MongoDB] Connections closed.")


def sanitize_mongo_query(query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize a MongoDB query filter dict to prevent NoSQL operator injection.
    Recursively strips keys containing '$' or '.' from user input dictionaries.
    """
    if not isinstance(query, dict):
        return query
    
    clean: Dict[str, Any] = {}
    for k, v in query.items():
        if isinstance(k, str) and (k.startswith("$") or "." in k):
            continue  # Disallow operator injection in top-level query dicts
        if isinstance(v, dict):
            safe_sub = {sk: sv for sk, sv in v.items() if isinstance(sk, str) and not sk.startswith("$")}
            clean[k] = safe_sub
        elif isinstance(v, list):
            clean[k] = [sanitize_mongo_query(item) if isinstance(item, dict) else item for item in v]
        else:
            clean[k] = v
    return clean
