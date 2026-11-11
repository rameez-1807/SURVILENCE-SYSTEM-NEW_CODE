"""
AI Surveillance & Attendance System - MySQL Database Initializer
Run this script to automatically create all required tables in any MySQL database.

Usage:
  python scripts/init_mysql_database.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' imports work directly
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


async def init_database():
    from app.db.session import engine
    from app.db.base import Base
    import app.models  # loads all models into Base.metadata

    logger.info("Connecting to MySQL Database...")
    async with engine.begin() as conn:
        logger.info("Creating all database tables if they do not exist...")
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Tables checked/created successfully:")
        for table_name in Base.metadata.tables.keys():
            logger.info(f"  ✓ {table_name}")

    await engine.dispose()
    logger.info("\n✅ MySQL Database is 100% ready for Attendance & Face Recognition!")


if __name__ == "__main__":
    try:
        asyncio.run(init_database())
    except Exception as exc:
        logger.error(f"Failed to initialize database: {exc}")
        sys.exit(1)
