import uuid
from datetime import datetime, timezone
import asyncio

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.camera import Camera
from app.models.event import Event
from app.models.site import Site
from app.models.tenant import Tenant
from app.schemas.event import EventCreate
from app.services.event import EventService
from app.core.ai.models import DetectionResult
from tests.conftest import TestSessionLocal

async def create_test_tenant(name: str = "Test Tenant") -> Tenant:
    async with TestSessionLocal() as session:
        tenant = Tenant(name=name)
        session.add(tenant)
        await session.commit()
        await session.refresh(tenant)
        return tenant

async def create_test_site(tenant_id: uuid.UUID, name: str = "Test Site") -> Site:
    import json
    async with TestSessionLocal() as session:
        site = Site(
            tenant_id=tenant_id,
            name=name,
            timezone="UTC",
            address_json=json.dumps({"city": "Test"})
        )
        session.add(site)
        await session.commit()
        await session.refresh(site)
        return site

async def create_test_camera(tenant_id: uuid.UUID, site_id: uuid.UUID, name: str = "Test Cam") -> Camera:
    async with TestSessionLocal() as session:
        camera = Camera(
            tenant_id=tenant_id,
            site_id=site_id,
            name=name,
            host="1.2.3.4",
            stream_path="/"
        )
        session.add(camera)
        await session.commit()
        await session.refresh(camera)
        return camera


@pytest.fixture
async def test_hierarchy():
    tenant = await create_test_tenant()
    site = await create_test_site(tenant_id=tenant.id)
    camera = await create_test_camera(tenant_id=tenant.id, site_id=site.id)
    return tenant, site, camera


@pytest.mark.asyncio
async def test_create_event_success(test_hierarchy):
    tenant, site, camera = test_hierarchy
    
    event_in = EventCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        camera_id=camera.id,
        event_type="person_detected",
        severity="low",
        state="OPEN",
        observed_at=datetime.now(timezone.utc),
        confidence=0.95,
        model_id="yolov8n",
        model_version="1.0",
        dedupe_key="unique_event_123"
    )
    
    async with TestSessionLocal() as db_session:
        event = await EventService.create_event(db_session, event_in)
        
        assert event.id is not None
        assert event.tenant_id == tenant.id
        assert event.event_type == "person_detected"


@pytest.mark.asyncio
async def test_event_deduplication(test_hierarchy):
    tenant, site, camera = test_hierarchy
    
    event_in = EventCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        camera_id=camera.id,
        event_type="object_detected",
        severity="medium",
        state="OPEN",
        observed_at=datetime.now(timezone.utc),
        confidence=0.85,
        model_id="yolov8n",
        model_version="1.0",
        dedupe_key="dedupe_me_456"
    )
    
    async with TestSessionLocal() as db_session:
        # First creation should succeed
        event1 = await EventService.create_event(db_session, event_in)
        
        # Second creation with same dedupe_key should silently return the first one
        event2 = await EventService.create_event(db_session, event_in)
        
        assert event1.id == event2.id
        
        # Verify only one exists in DB
        events = await EventService.get_tenant_events(db_session, tenant.id)
        assert len(events) == 1


@pytest.mark.asyncio
async def test_event_cross_tenant_isolation(test_hierarchy):
    tenant1, site1, camera1 = test_hierarchy
    tenant2 = await create_test_tenant(name="Tenant 2")
    site2 = await create_test_site(tenant_id=tenant2.id, name="Site 2")
    camera2 = await create_test_camera(tenant_id=tenant2.id, site_id=site2.id, name="Cam 2")
    
    event_in_1 = EventCreate(
        tenant_id=tenant1.id,
        site_id=site1.id,
        camera_id=camera1.id,
        event_type="test",
        observed_at=datetime.now(timezone.utc),
        confidence=0.5,
        model_id="m1",
        model_version="v1",
        dedupe_key="key1"
    )
    
    event_in_2 = EventCreate(
        tenant_id=tenant2.id,
        site_id=site2.id,
        camera_id=camera2.id,
        event_type="test",
        observed_at=datetime.now(timezone.utc),
        confidence=0.5,
        model_id="m1",
        model_version="v1",
        dedupe_key="key2"
    )
    
    async with TestSessionLocal() as db_session:
        await EventService.create_event(db_session, event_in_1)
        await EventService.create_event(db_session, event_in_2)
        
        t1_events = await EventService.get_tenant_events(db_session, tenant1.id)
        assert len(t1_events) == 1
        assert t1_events[0].tenant_id == tenant1.id
        
        t2_events = await EventService.get_tenant_events(db_session, tenant2.id)
        assert len(t2_events) == 1
        assert t2_events[0].tenant_id == tenant2.id

@pytest.mark.asyncio
async def test_process_detection_result(test_hierarchy):
    tenant, site, camera = test_hierarchy
    
    detection = DetectionResult(
        camera_id=camera.id,
        frame_id=1,
        observed_at=datetime.now(timezone.utc),
        confidence=0.88,
        bounding_box=[0.1, 0.1, 0.5, 0.5],
        model_id="yolov8n",
        model_version="1.0",
        processing_time_ms=10.0,
        label="person"
    )
    
    async with TestSessionLocal() as db_session:
        event = await EventService.process_detection(db_session, detection)
        assert event is not None
        assert event.event_type == "person_detected"
        assert event.site_id == site.id
        assert event.camera_id == camera.id
        assert event.confidence == 0.88
        assert event.model_id == "yolov8n"
        assert event.severity == "low"
        assert event.state == "OPEN"

@pytest.mark.asyncio
async def test_event_concurrent_deduplication(test_hierarchy, monkeypatch):
    tenant, site, camera = test_hierarchy
    
    event_in = EventCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        camera_id=camera.id,
        event_type="concurrent_detected",
        severity="high",
        state="OPEN",
        observed_at=datetime.now(timezone.utc),
        confidence=0.9,
        model_id="yolov8n",
        model_version="1.0",
        dedupe_key="concurrent_key_123"
    )
    
    async with TestSessionLocal() as session:
        # First creation succeeds normally
        event1 = await EventService.create_event(session, event_in)
        await session.commit()
        
        # Now we want to simulate a race condition where get_by_dedupe_key returns None
        # but create() raises IntegrityError (as if another thread inserted it in between).
        from app.repositories.event import EventRepository
        
        original_get = EventRepository.get_by_dedupe_key
        original_create = EventRepository.create
        
        async def mock_get(self, tenant_id, dedupe_key):
            # Lie and say it doesn't exist to force it into create()
            return None
            
        async def mock_create(self, obj_in):
            # Throw IntegrityError to simulate concurrent insertion winning the race
            raise IntegrityError("Mock concurrent insert", orig=Exception("Mock"), params={})
            
        monkeypatch.setattr(EventRepository, "get_by_dedupe_key", mock_get)
        monkeypatch.setattr(EventRepository, "create", mock_create)
        
        # In the exception handler, create_event will query AGAIN.
        # We need the second query to actually return the event!
        # But our mock_get always returns None.
        # So let's make mock_get return None only the FIRST time it's called.
        
        call_count = {"get": 0}
        async def stateful_mock_get(self, tenant_id, dedupe_key):
            call_count["get"] += 1
            if call_count["get"] == 1:
                return None
            return await original_get(self, tenant_id, dedupe_key)
            
        monkeypatch.setattr(EventRepository, "get_by_dedupe_key", stateful_mock_get)
        
        # Attempt to create again
        event2 = await EventService.create_event(session, event_in)
        
        assert event2.id == event1.id


@pytest.mark.asyncio
async def test_event_state_transitions(test_hierarchy):
    tenant, site, camera = test_hierarchy
    
    event_in = EventCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        camera_id=camera.id,
        event_type="test_transitions",
        severity="medium",
        state="OPEN",
        observed_at=datetime.now(timezone.utc),
        confidence=0.95,
        model_id="test",
        model_version="1",
        dedupe_key="transition_key"
    )
    
    async with TestSessionLocal() as session:
        event = await EventService.create_event(session, event_in)
        
        # Test: OPEN -> ACKNOWLEDGED
        event = await EventService.transition_state(
            session, event.id, "ACKNOWLEDGED", reason="User acknowledged"
        )
        assert event.state == "ACKNOWLEDGED"
        
        # Test: ACKNOWLEDGED -> ASSIGNED
        event = await EventService.transition_state(
            session, event.id, "ASSIGNED", reason="Assigned to security"
        )
        assert event.state == "ASSIGNED"
        
        # Test: ASSIGNED -> CLOSED
        event = await EventService.transition_state(
            session, event.id, "CLOSED", reason="False alarm"
        )
        assert event.state == "CLOSED"
        
        # Check invalid transition
        with pytest.raises(ValueError, match="Invalid state transition from CLOSED to OPEN"):
            await EventService.transition_state(
                session, event.id, "OPEN", reason="Try to reopen"
            )
            
        # Verify Audit logs
        from app.models.event import EventAudit
        from sqlalchemy import select
        
        result = await session.execute(
            select(EventAudit).where(EventAudit.event_id == event.id).order_by(EventAudit.created_at)
        )
        audits = result.scalars().all()
        
        assert len(audits) == 3
        assert audits[0].previous_state == "OPEN"
        assert audits[0].new_state == "ACKNOWLEDGED"
        
        assert audits[1].previous_state == "ACKNOWLEDGED"
        assert audits[1].new_state == "ASSIGNED"
        
        assert audits[2].previous_state == "ASSIGNED"
        assert audits[2].new_state == "CLOSED"


