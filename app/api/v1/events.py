"""
AI Surveillance System - Events API Router
"""

import uuid
from typing import Annotated, Optional, List

from fastapi import APIRouter, Depends, Header, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, RoleChecker, get_db
from app.models.membership import Role
from app.schemas.event import EventResponse
from app.services.event import EventService
from app.repositories.event import EventRepository

router = APIRouter(prefix="/events", tags=["Events"])

# Operators can transition states
WriteRoles = Depends(RoleChecker([Role.OPERATOR, Role.SUPERVISOR, Role.INSTALLER, Role.OEM_ADMIN]))
ReadRoles = Depends(RoleChecker([Role.OPERATOR, Role.SUPERVISOR, Role.INSTALLER, Role.OEM_ADMIN, Role.PLATFORM_ADMIN]))

TenantHeader = Annotated[uuid.UUID | None, Header(alias="X-Tenant-ID")]

def get_tenant_id_context(current_user: CurrentUser, x_tenant_id: TenantHeader = None) -> uuid.UUID | None:
    # If platform admin, allow them to use the provided x_tenant_id or fallback to None for global
    for membership in current_user.memberships:
        if membership.role == Role.PLATFORM_ADMIN:
            return x_tenant_id
    return x_tenant_id


class StateTransitionRequest(BaseModel):
    reason: Optional[str] = None


@router.get("", response_model=List[EventResponse], dependencies=[ReadRoles])
async def list_events(
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> List[EventResponse]:
    """List events for the tenant."""
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if not user_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context required")
        
    events = await EventService.get_tenant_events(
        db, tenant_id=user_tenant_id, skip=skip, limit=limit
    )
    return events


@router.get("/{event_id}", response_model=EventResponse, dependencies=[ReadRoles])
async def get_event(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """Get a specific event."""
    # Since there's no get_by_id in EventRepository yet, we fetch via DB directly
    from app.models.event import Event
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if user_tenant_id and event.tenant_id != user_tenant_id:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return event


async def _transition_event(
    event_id: uuid.UUID,
    new_state: str,
    reason: Optional[str],
    current_user: CurrentUser,
    x_tenant_id: Optional[uuid.UUID],
    db: AsyncSession
) -> EventResponse:
    from app.models.event import Event
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if user_tenant_id and event.tenant_id != user_tenant_id:
        raise HTTPException(status_code=404, detail="Event not found")
        
    try:
        updated = await EventService.transition_state(
            db, event_id, new_state, user_id=current_user.id, reason=reason
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{event_id}/acknowledge", response_model=EventResponse, dependencies=[WriteRoles])
async def acknowledge_event(
    event_id: uuid.UUID,
    request: StateTransitionRequest,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """Transition an event from OPEN to ACKNOWLEDGED."""
    return await _transition_event(event_id, "ACKNOWLEDGED", request.reason, current_user, x_tenant_id, db)


@router.post("/{event_id}/assign", response_model=EventResponse, dependencies=[WriteRoles])
async def assign_event(
    event_id: uuid.UUID,
    request: StateTransitionRequest,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """Transition an event from ACKNOWLEDGED to ASSIGNED."""
    return await _transition_event(event_id, "ASSIGNED", request.reason, current_user, x_tenant_id, db)


@router.post("/{event_id}/close", response_model=EventResponse, dependencies=[WriteRoles])
async def close_event(
    event_id: uuid.UUID,
    request: StateTransitionRequest,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """Transition an event to CLOSED."""
    return await _transition_event(event_id, "CLOSED", request.reason, current_user, x_tenant_id, db)
