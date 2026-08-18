import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.schemas.event import EventCreate, EventUpdate


class EventRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_dedupe_key(self, tenant_id: uuid.UUID, dedupe_key: str) -> Optional[Event]:
        """Fetch an event by its tenant_id and dedupe_key to enforce idempotency."""
        stmt = select(Event).where(
            Event.tenant_id == tenant_id,
            Event.dedupe_key == dedupe_key
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi_by_tenant(
        self, tenant_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> list[Event]:
        """Fetch events for a specific tenant."""
        stmt = (
            select(Event)
            .where(Event.tenant_id == tenant_id)
            .order_by(Event.observed_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: EventCreate) -> Event:
        """Create a new event."""
        db_obj = Event(**obj_in.model_dump())
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj
