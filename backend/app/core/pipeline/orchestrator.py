"""
AI Surveillance System - Pipeline Orchestrator

Background service that connects CameraManager (FrameHub) to the real-time DetectionPipeline.
Handles continuous capture, frame buffering, YOLO detection, ByteTrack tracking,
temporal confirmation, debouncing, zone evaluation, and WebSocket event broadcasts.
"""

import asyncio
import logging
import uuid
from typing import Any, Dict, Optional

from sqlalchemy.orm import sessionmaker

from app.core.ai.models import FrameEnvelope
from app.core.camera.hub import ConsumerStrategy, FrameHub
from app.core.camera.manager import CameraManager
from app.core.config import settings
from app.services.detection.pipeline import DetectionPipeline

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    """
    Singleton coordinator for all active camera detection pipelines.
    """

    _instance = None

    def __new__(cls, session_maker: sessionmaker):
        if cls._instance is None:
            cls._instance = super(PipelineOrchestrator, cls).__new__(cls)
            cls._instance._init_state(session_maker)
        return cls._instance

    def _init_state(self, session_maker: sessionmaker):
        self.session_maker = session_maker
        self.hub = FrameHub()
        self.camera_manager = CameraManager()
        self.active_tasks: Dict[uuid.UUID, asyncio.Task] = {}
        self.active_pipelines: Dict[uuid.UUID, DetectionPipeline] = {}
        self._running = False

    async def start(self):
        """Starts the orchestrator background service."""
        if not settings.DETECTION_ENABLED:
            logger.info("Real-Time Detection Pipeline is disabled via DETECTION_ENABLED=false")
            return

        logger.info("Starting Pipeline Orchestrator with YOLOv8 & ByteTrack...")
        self._running = True

        # Fetch all cameras from the database
        try:
            async with self.session_maker() as db:
                from app.models.camera import Camera
                from sqlalchemy import select
                result = await db.execute(select(Camera))
                cameras = result.scalars().all()

            for camera in cameras:
                await self.start_camera(camera)
        except Exception as e:
            logger.error(f"Failed to query cameras on startup: {e}")

    async def stop(self):
        """Stops the orchestrator and all active pipelines."""
        logger.info("Stopping Pipeline Orchestrator...")
        self._running = False

        for task in self.active_tasks.values():
            task.cancel()

        await asyncio.sleep(0.5)
        self.active_tasks.clear()
        self.active_pipelines.clear()
        self.camera_manager.shutdown_all()

    async def start_camera(self, camera: Any):
        """Starts capture and detection pipeline for a camera."""
        if camera.id in self.active_tasks:
            return

        # 1. Start capture worker in background thread
        self.camera_manager.start_stream(camera.id, camera.stream_path, camera.stream_profile)

        # 2. Subscribe to FrameHub with LATEST strategy to prevent memory growth
        queue = self.hub.subscribe(
            camera_id=camera.id,
            consumer_name="yolo-bytetrack-pipeline",
            strategy=ConsumerStrategy.LATEST,
            max_size=5
        )

        # 3. Create DetectionPipeline instance
        pipeline = DetectionPipeline(
            camera_id=camera.id,
            tenant_id=camera.tenant_id,
            session_maker=self.session_maker,
            min_confidence=settings.DETECTION_MIN_CONFIDENCE,
            confirm_frames=settings.DETECTION_CONFIRM_FRAMES,
            cooldown_seconds=settings.DETECTION_EVENT_COOLDOWN,
        )
        pipeline.initialize()
        self.active_pipelines[camera.id] = pipeline

        # 4. Launch async processing loop
        task = asyncio.create_task(self._process_loop(camera.id, pipeline, queue))
        self.active_tasks[camera.id] = task
        logger.info(f"Real-Time Detection Pipeline active for camera: {camera.name} ({camera.id})")

    async def stop_camera(self, camera_id: uuid.UUID):
        """Stops pipeline and capture for a specific camera."""
        task = self.active_tasks.pop(camera_id, None)
        if task:
            task.cancel()
        self.active_pipelines.pop(camera_id, None)
        self.hub.unsubscribe(camera_id, "yolo-bytetrack-pipeline")
        self.camera_manager.stop_stream(camera_id)
        logger.info(f"Pipeline stopped for camera {camera_id}")

    def get_pipeline(self, camera_id: uuid.UUID) -> Optional[DetectionPipeline]:
        return self.active_pipelines.get(camera_id)

    async def _process_loop(self, camera_id: uuid.UUID, pipeline: DetectionPipeline, queue: Any):
        """
        Continuous worker pulling latest frames from queue and running inference/tracking.
        """
        logger.info(f"Process loop started for camera {camera_id}")
        while self._running:
            try:
                # Non-blocking get in thread to not block asyncio event loop
                frame_data, metadata = await asyncio.to_thread(queue.get, timeout=1.0)

                if frame_data is None or metadata is None:
                    continue

                envelope = FrameEnvelope(metadata=metadata, frame_data=frame_data)

                # Process through DetectionPipeline (YOLO → Tracker → Confirmation → Rules)
                await pipeline.process_frame(envelope)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pipeline loop for camera {camera_id}: {e}", exc_info=True)
                await asyncio.sleep(0.5)

        logger.info(f"Process loop exited for camera {camera_id}")


# Global orchestrator singleton instance
from app.db.session import async_session_factory
pipeline_orchestrator = PipelineOrchestrator(async_session_factory)
