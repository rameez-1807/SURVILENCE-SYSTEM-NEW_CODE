import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.event import Event, EventAudit
from app.repositories.camera import CameraRepository
from app.repositories.event import EventRepository
from app.schemas.event import EventCreate, EventResponse
from app.core.ai.models import DetectionResult
from app.core.websockets.manager import ws_manager

logger = logging.getLogger(__name__)


class EventService:
    @staticmethod
    async def create_event(db: AsyncSession, event_in: EventCreate) -> Event:
        """
        Creates a new event. Enforces idempotency via the dedupe_key.
        If an event with the same dedupe_key exists for the tenant, it returns the existing event
        instead of creating a new one (silent deduplication).
        """
        repo = EventRepository(db)
        existing = await repo.get_by_dedupe_key(
            tenant_id=event_in.tenant_id, dedupe_key=event_in.dedupe_key
        )
        if existing:
            logger.debug(f"Event deduplicated for key {event_in.dedupe_key}")
            return existing

        try:
            event = await repo.create(obj_in=event_in)
            event_dict = EventResponse.model_validate(event).model_dump(mode="json")
            await ws_manager.broadcast_event(event.tenant_id, event_dict, action="event.created")
            return event
        except IntegrityError:
            await db.rollback()
            existing = await repo.get_by_dedupe_key(
                tenant_id=event_in.tenant_id, dedupe_key=event_in.dedupe_key
            )
            if existing:
                logger.debug(f"Event concurrently deduplicated for key {event_in.dedupe_key}")
                return existing
            raise

    @staticmethod
    async def get_tenant_events(
        db: AsyncSession, tenant_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> list[Event]:
        """Fetches events strictly scoped to a tenant."""
        repo = EventRepository(db)
        return await repo.get_multi_by_tenant(tenant_id=tenant_id, skip=skip, limit=limit)

    @staticmethod
    async def process_detection(
        db: AsyncSession, 
        result: DetectionResult,
        rule_id: Optional[uuid.UUID] = None,
        severity: str = "low"
    ) -> Optional[Event]:
        """Converts an AI DetectionResult into a persisted Event."""
        camera_repo = CameraRepository(db)
        camera = await camera_repo.get_by_id(result.camera_id)
        if not camera:
            logger.warning(f"Camera {result.camera_id} not found for detection mapping.")
            return None
            
        event_type = f"{result.label}_detected"
        
        # Dedupe by minute + camera + label + rule (if any)
        minute_str = result.observed_at.strftime('%Y%m%d%H%M')
        dedupe_key = f"{camera.id}_{result.label}_{minute_str}"
        if rule_id:
            dedupe_key = f"{dedupe_key}_{rule_id}"
        
        event_in = EventCreate(
            tenant_id=camera.tenant_id,
            site_id=camera.site_id,
            camera_id=camera.id,
            rule_id=rule_id,
            event_type=event_type,
            severity=severity,
            state="OPEN",
            observed_at=result.observed_at,
            confidence=result.confidence,
            model_id=result.model_id,
            model_version=result.model_version,
            dedupe_key=dedupe_key
        )
        
        return await EventService.create_event(db, event_in)

    @staticmethod
    async def transition_state(
        db: AsyncSession, 
        event_id: uuid.UUID, 
        new_state: str, 
        user_id: Optional[uuid.UUID] = None, 
        reason: Optional[str] = None
    ) -> Event:
        """
        Transitions an event to a new state, enforcing valid state machine rules.
        Creates an audit record for the transition.
        """
        VALID_TRANSITIONS = {
            "OPEN": ["ACKNOWLEDGED"],
            "ACKNOWLEDGED": ["ASSIGNED"],
            "ASSIGNED": ["CLOSED"]
        }
        
        repo = EventRepository(db)
        # We need a get_by_id in EventRepository if it doesn't exist.
        # Let's assume we can get it via db directly for simplicity or we add it to repo.
        event = await db.get(Event, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
            
        current_state = event.state
        allowed_next_states = VALID_TRANSITIONS.get(current_state, [])
        
        if new_state not in allowed_next_states:
            raise ValueError(f"Invalid state transition from {current_state} to {new_state}")
            
        event.state = new_state
        
        audit = EventAudit(
            event_id=event.id,
            user_id=user_id,
            previous_state=current_state,
            new_state=new_state,
            reason=reason
        )
        db.add(audit)
        
        await db.flush()
        await db.refresh(event)
        
        event_dict = EventResponse.model_validate(event).model_dump(mode="json")
        await ws_manager.broadcast_event(event.tenant_id, event_dict, action="event.updated")
        
        return event
