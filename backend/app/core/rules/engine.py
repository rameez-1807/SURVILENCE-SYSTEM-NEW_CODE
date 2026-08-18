import logging
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.models import DetectionResult
from app.core.rules.evaluators import evaluate_schedule, evaluate_zone
from app.models.event import Event
from app.repositories.camera import CameraRepository
from app.services.event import EventService
from app.services.rule import RuleService

logger = logging.getLogger(__name__)

class RulesEngine:
    """
    Evaluates AI detections against configured rules to generate verified Events/Alerts.
    """
    
    @staticmethod
    async def evaluate(db: AsyncSession, detection: DetectionResult) -> List[Event]:
        # 1. Fetch camera context
        camera_repo = CameraRepository(db)
        camera = await camera_repo.get_by_id(detection.camera_id)
        if not camera:
            logger.warning(f"Camera {detection.camera_id} not found during rule evaluation.")
            return []
            
        # 2. Fetch all enabled rules for this tenant
        # We fetch all tenant rules, then filter in-memory for site matching
        # (Could also be optimized at the DB level, but doing it in-memory allows caching later)
        tenant_rules = await RuleService.get_tenant_rules(db, tenant_id=camera.tenant_id, limit=1000)
        
        # 3. Evaluate each rule
        matched_events = []
        
        for rule in tenant_rules:
            if not rule.enabled:
                continue
                
            # Filter by site (Global rules have site_id = None)
            if rule.site_id is not None and rule.site_id != camera.site_id:
                continue
                
            # Filter by detection class
            if rule.detection_class != detection.label:
                continue
                
            # Filter by confidence
            if detection.confidence < rule.confidence_threshold:
                continue
                
            # Filter by schedule
            if not evaluate_schedule(detection.observed_at, rule.schedule_configuration):
                continue
                
            # Filter by zone
            if not evaluate_zone(detection.bounding_box, rule.zone_configuration):
                continue
                
            # All checks passed!
            logger.info(f"Detection matched rule {rule.name} ({rule.id})")
            event = await EventService.process_detection(
                db=db,
                result=detection,
                rule_id=rule.id,
                severity=rule.severity
            )
            if event:
                matched_events.append(event)
            
        return matched_events
