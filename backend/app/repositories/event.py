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

        try:
            from app.db.mongodb import get_async_db
            mongo_db = get_async_db()
            mongo_doc = {
                "_id": str(db_obj.id),
                "id": str(db_obj.id),
                "tenant_id": str(db_obj.tenant_id),
                "site_id": str(db_obj.site_id),
                "camera_id": str(db_obj.camera_id),
                "rule_id": str(db_obj.rule_id) if db_obj.rule_id else None,
                "event_type": db_obj.event_type,
                "severity": db_obj.severity,
                "state": db_obj.state,
                "observed_at": db_obj.observed_at,
                "confidence": db_obj.confidence,
                "needs_review": db_obj.needs_review,
                "is_llm_verified": db_obj.is_llm_verified,
                "corrected_label": db_obj.corrected_label,
                "model_id": db_obj.model_id,
                "model_version": db_obj.model_version,
                "evidence_reference": db_obj.evidence_reference,
                "dedupe_key": db_obj.dedupe_key,
                "track_id": db_obj.track_id,
                "created_at": db_obj.created_at,
                "updated_at": db_obj.updated_at,
            }
            await mongo_db.events.replace_one({"_id": str(db_obj.id)}, mongo_doc, upsert=True)
        except Exception:
            pass

        return db_obj

