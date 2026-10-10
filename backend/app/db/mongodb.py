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
from typing import Optional
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
import motor.motor_asyncio

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

        kwargs = {
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

        kwargs = {
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
    try:
        db = get_async_db()

        # 1. Events collection indexes
        await db.events.create_index([("observed_at", -1)])
        await db.events.create_index([("event_type", 1)])
        await db.events.create_index([("track_id", 1)])
        await db.events.create_index([("dedupe_key", 1)])
        await db.events.create_index([("camera_id", 1)])

        # 2. Vehicles collection indexes
        await db.vehicles.create_index([("timestamp", -1)])
        await db.vehicles.create_index([("plate_number", 1)])

        # 3. Employees collection indexes
        await db.employees.create_index([("code", 1)])
        await db.employees.create_index([("email", 1)])

        # 4. Attendance records collection indexes
        await db.attendance_records.create_index([("date", -1)])
        await db.attendance_records.create_index([("employee_uuid", 1)])

        # 5. Cameras collection indexes
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
