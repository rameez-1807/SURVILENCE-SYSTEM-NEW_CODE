"""
AI Surveillance System - Real-Time Detection Pipeline

Per-camera orchestrator connecting:
Capture/Hub → YOLO Detection → ByteTrack Tracking → Confidence Filter →
Temporal Confirmation (N frames) → Cooldown Debouncing → Rules/Zone Evaluation →
Evidence Snapshot Capture → Event Persistence → Real-time WebSocket Broadcast.
"""

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.ai.models import DetectionResult, FrameEnvelope
from app.core.ai.tracker import ObjectTracker, TrackedObject
from app.core.ai.yolo_plugin import YoloPlugin
from app.core.config import settings
from app.core.rules.engine import RulesEngine
from app.services.detection.evidence import evidence_manager
from app.services.detection.groq_verifier import groq_verifier
from app.services.detection.metrics import metrics_collector

logger = logging.getLogger(__name__)


class DetectionPipeline:
    """
    Manages detection, tracking, confirmation, and event generation for a single camera.
    """

    def __init__(
        self,
        camera_id: uuid.UUID,
        session_maker: sessionmaker,
        min_confidence: Optional[float] = None,
        confirm_frames: Optional[int] = None,
        cooldown_seconds: Optional[int] = None,
    ):
        self.camera_id = camera_id
        self.session_maker = session_maker

        self.min_confidence = min_confidence if min_confidence is not None else settings.DETECTION_MIN_CONFIDENCE
        self.confirm_frames = confirm_frames if confirm_frames is not None else settings.DETECTION_CONFIRM_FRAMES
        self.cooldown_seconds = cooldown_seconds if cooldown_seconds is not None else settings.DETECTION_EVENT_COOLDOWN

        # Internal AI components
        self.plugin = YoloPlugin(camera_id)
        self.tracker = ObjectTracker(camera_id)

        # Temporal Confirmation Map: track_id -> consecutive confirmed frames count
        self._track_confirmations: Dict[int, int] = {}

        # Cooldown Map: (track_id, label) -> last_event_timestamp
        self._event_cooldowns: Dict[Tuple[int, str], float] = {}

        # Latest frame tracking for queries
        self._latest_tracks: List[TrackedObject] = []
        self._latest_detections: List[DetectionResult] = []

    def initialize(self):
        """Pre-initialize plugin & tracker."""
        self.plugin.initialize()

    async def process_frame(self, envelope: FrameEnvelope) -> List[Any]:
        """
        Process a single incoming frame envelope through the full surveillance pipeline.
        """
        frame_data = envelope.frame_data
        frame_id = envelope.metadata.frame_id
        now = time.time()

        # 1. Save frame to evidence rolling buffer
        evidence_manager.push_frame(self.camera_id, frame_data, frame_id)

        # 2. Run YOLO inference in thread pool (non-blocking for asyncio loop)
        detections: List[DetectionResult] = await asyncio.to_thread(self.plugin.process, envelope)
        self._latest_detections = detections

        # Record metrics
        metrics_collector.record_inference(
            latency_ms=self.plugin._last_inference_ms,
            detections_count=len(detections),
            camera_id=self.camera_id
        )

        if not detections:
            # Still update tracker to age out stale tracks
            if frame_data is not None and hasattr(frame_data, "shape"):
                await asyncio.to_thread(self.tracker.update, [], frame_data.shape)
            self._latest_tracks = []
            metrics_collector.update_active_tracks(self.camera_id, 0)
            return []

        # 3. Filter by minimum confidence
        valid_detections = [d for d in detections if d.confidence >= self.min_confidence]

        # 4. Run ByteTrack Tracker
        tracked_objects: List[TrackedObject] = await asyncio.to_thread(
            self.tracker.update, valid_detections, frame_data.shape
        )
        self._latest_tracks = tracked_objects
        metrics_collector.update_active_tracks(self.camera_id, len(tracked_objects))

        # 5. Temporal Confirmation & Debounced Event Generation
        confirmed_events = []

        for tracked in tracked_objects:
            tid = tracked.track_id
            label = tracked.class_name

            # Update temporal confirmation counter
            self._track_confirmations[tid] = self._track_confirmations.get(tid, 0) + 1
            consecutive_seen = self._track_confirmations[tid]

            # Require N consecutive frames to confirm object existence (rejects single-frame flicker)
            if consecutive_seen < self.confirm_frames:
                continue

            # Check cooldown debouncing (prevents generating hundreds of duplicate events per second)
            cooldown_key = (tid, label)
            last_event_time = self._event_cooldowns.get(cooldown_key, 0.0)
            if (now - last_event_time) < self.cooldown_seconds:
                continue

            # This object is CONFIRMED and COOLDOWN has passed! Trigger security evaluation
            self._event_cooldowns[cooldown_key] = now

            # 6. Capture Evidence Snapshot
            snapshot_path = evidence_manager.capture_snapshot(
                camera_id=self.camera_id,
                label=label,
                confidence=tracked.confidence,
                bbox=tracked.bbox,
                track_id=tid
            )

            # 7. Convert to DetectionResult with track_id attached
            det_for_rules = DetectionResult(
                camera_id=self.camera_id,
                frame_id=frame_id,
                observed_at=envelope.metadata.timestamp,
                confidence=tracked.confidence,
                bounding_box=tracked.bbox,
                model_id=self.plugin.manifest.id if self.plugin.manifest else "yolo-v8",
                model_version=self.plugin.manifest.version if self.plugin.manifest else "1.0.0",
                processing_time_ms=self.plugin._last_inference_ms,
                label=label
            )

            # 8. Evaluate Rules Engine in DB Session
            try:
                async with self.session_maker() as db:
                    # Evaluate rules (zones, schedules, classes)
                    events = await RulesEngine.evaluate(db, det_for_rules)
                    if events:
                        for evt in events:
                            # Attach evidence & track_id
                            if snapshot_path:
                                evt.evidence_reference = snapshot_path
                            metrics_collector.record_event()
                            confirmed_events.append(evt)

                            # Asynchronously schedule Groq secondary verification if high severity
                            if snapshot_path and evt.severity in ("high", "critical", "medium"):
                                asyncio.create_task(
                                    self._run_groq_enrichment(snapshot_path, label, tracked.confidence)
                                )

                        await db.commit()
            except Exception as e:
                logger.error(f"Error evaluating rules for camera {self.camera_id}: {e}", exc_info=True)

        return confirmed_events

    async def _run_groq_enrichment(self, snapshot_path: str, label: str, confidence: float):
        """Background task for secondary Groq Vision verification."""
        try:
            desc = await groq_verifier.verify_event_snapshot(
                image_path=snapshot_path,
                detected_label=label,
                confidence=confidence
            )
            if desc:
                logger.info(f"Groq verification enriched for {label}: {desc}")
        except Exception as e:
            logger.debug(f"Groq enrichment background task: {e}")

    def get_active_tracks(self) -> List[TrackedObject]:
        """Return currently tracked objects."""
        return self._latest_tracks

    def get_latest_detections(self) -> List[DetectionResult]:
        """Return latest raw detections."""
        return self._latest_detections
