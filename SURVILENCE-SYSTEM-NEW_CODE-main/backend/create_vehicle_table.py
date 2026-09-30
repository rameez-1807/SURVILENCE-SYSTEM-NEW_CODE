import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.db.base import Base
from app.models.vehicle import VehicleRecord

async def init_tables():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        print("Ensuring vehicle_records table exists in database...")
        await conn.run_sync(Base.metadata.create_all)
    print("Table creation check complete!")

if __name__ == "__main__":
    asyncio.run(init_tables())
