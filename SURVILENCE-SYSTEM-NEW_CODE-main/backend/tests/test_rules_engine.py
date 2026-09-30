from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.models import DetectionResult
from app.core.rules.engine import RulesEngine
from app.models.rule import Rule
from app.schemas.rule import RuleCreate
from app.services.rule import RuleService
from app.services.event import EventService
from tests.conftest import TestSessionLocal
from tests.test_events import create_test_tenant, create_test_site, create_test_camera


@pytest.fixture
async def rules_engine_hierarchy():
    tenant = await create_test_tenant()
    site = await create_test_site(tenant_id=tenant.id)
    camera = await create_test_camera(tenant_id=tenant.id, site_id=site.id)
    return tenant, site, camera


@pytest.mark.asyncio
async def test_engine_truth_table(rules_engine_hierarchy):
    tenant, site, camera = rules_engine_hierarchy
    now = datetime.now(timezone.utc)
    
    # 1. Base Setup: Schedule, Zone, Rule
    # Active from 18:00 to 06:00, Monday only
    schedule_config = {
        "days": ["Mon"],
        "start_time": "18:00",
        "end_time": "06:00"
    }
    
    # [0.0, 0.0] to [0.5, 0.5] square
    zone_config = {
        "polygons": [
            [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]]
        ]
    }
    
    rule_in = RuleCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        name="Master Rule",
        detection_class="person",
        confidence_threshold=0.8,
        zone_configuration=zone_config,
        schedule_configuration=schedule_config,
        severity="high",
        enabled=True
    )
    
    async with TestSessionLocal() as db:
        rule = await RuleService.create_rule(db, rule_in)
        
        # Calculate valid Monday night time
        days_ahead = 0 - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        next_monday = now + timedelta(days=days_ahead)
        valid_time = next_monday.replace(hour=20, minute=0)
        invalid_time = next_monday.replace(hour=12, minute=0)
        
        # Case 1: Correct class + correct zone + correct schedule + high confidence → alert
        detection_valid = DetectionResult(
            camera_id=camera.id,
            frame_id=1,
            observed_at=valid_time,
            confidence=0.9,
            bounding_box=[0.1, 0.1, 0.4, 0.4], # Center 0.25, 0.25 -> Inside
            model_id="test",
            model_version="1",
            processing_time_ms=10.0,
            label="person" # Correct class
        )
        events_valid = await RulesEngine.evaluate(db, detection_valid)
        assert len(events_valid) == 1
        assert events_valid[0].rule_id == rule.id
        
        # Case 2: Wrong class → no alert
        detection_wrong_class = DetectionResult(
            camera_id=camera.id,
            frame_id=2,
            observed_at=valid_time,
            confidence=0.9,
            bounding_box=[0.1, 0.1, 0.4, 0.4], 
            model_id="test",
            model_version="1",
            processing_time_ms=10.0,
            label="vehicle" # Wrong class
        )
        events_wrong_class = await RulesEngine.evaluate(db, detection_wrong_class)
        assert len(events_wrong_class) == 0
        
        # Case 3: Wrong zone → no alert
        detection_wrong_zone = DetectionResult(
            camera_id=camera.id,
            frame_id=3,
            observed_at=valid_time,
            confidence=0.9,
            bounding_box=[0.6, 0.6, 0.9, 0.9], # Center 0.75, 0.75 -> Outside
            model_id="test",
            model_version="1",
            processing_time_ms=10.0,
            label="person"
        )
        events_wrong_zone = await RulesEngine.evaluate(db, detection_wrong_zone)
        assert len(events_wrong_zone) == 0
        
        # Case 4: Outside schedule → no alert
        detection_wrong_schedule = DetectionResult(
            camera_id=camera.id,
            frame_id=4,
            observed_at=invalid_time,
            confidence=0.9,
            bounding_box=[0.1, 0.1, 0.4, 0.4],
            model_id="test",
            model_version="1",
            processing_time_ms=10.0,
            label="person"
        )
        events_wrong_schedule = await RulesEngine.evaluate(db, detection_wrong_schedule)
        assert len(events_wrong_schedule) == 0
        
        # Case 5: Confidence below threshold → no alert
        detection_low_conf = DetectionResult(
            camera_id=camera.id,
            frame_id=5,
            observed_at=valid_time,
            confidence=0.5, # Below 0.8
            bounding_box=[0.1, 0.1, 0.4, 0.4],
            model_id="test",
            model_version="1",
            processing_time_ms=10.0,
            label="person"
        )
        events_low_conf = await RulesEngine.evaluate(db, detection_low_conf)
        assert len(events_low_conf) == 0
        
        # Case 6: Disabled rule → no alert
        rule.enabled = False
        await db.commit()
        events_disabled = await RulesEngine.evaluate(db, detection_valid)
        assert len(events_disabled) == 0
        
        # Re-enable for further tests
        rule.enabled = True
        await db.commit()


@pytest.mark.asyncio
async def test_engine_multiple_rules_and_dedupe(rules_engine_hierarchy):
    tenant, site, camera = rules_engine_hierarchy
    
    # Create two rules that match the same detection
    rule1_in = RuleCreate(
        tenant_id=tenant.id,
        name="Rule 1",
        detection_class="person",
        severity="medium"
    )
    rule2_in = RuleCreate(
        tenant_id=tenant.id,
        name="Rule 2",
        detection_class="person",
        severity="high"
    )
    
    async with TestSessionLocal() as db:
        await RuleService.create_rule(db, rule1_in)
        await RuleService.create_rule(db, rule2_in)
        
        # Case 7: Multiple matching rules → expected alerts
        detection = DetectionResult(
            camera_id=camera.id,
            frame_id=1,
            observed_at=datetime.now(timezone.utc),
            confidence=0.9,
            bounding_box=[0.1, 0.1, 0.4, 0.4],
            model_id="test",
            model_version="1",
            processing_time_ms=10.0,
            label="person"
        )
        
        events = await RulesEngine.evaluate(db, detection)
        assert len(events) == 2
        
        # Case 8: Same detection evaluated repeatedly → no unintended duplicate alert
        # If we evaluate it again, EventService deduplication should silently return the SAME event objects.
        # So we get 2 events back again, but total DB count remains 2.
        events_second_pass = await RulesEngine.evaluate(db, detection)
        assert len(events_second_pass) == 2
        
        # Verify in DB
        db_events = await EventService.get_tenant_events(db, tenant.id)
        assert len(db_events) == 2
