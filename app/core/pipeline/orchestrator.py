"""
AI Surveillance System - Pipeline Orchestrator

Background service that connects the CameraManager (FrameHub) to the AI Plugins and RulesEngine.
"""

import asyncio
import logging
import uuid
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.camera.hub import FrameHub, ConsumerStrategy
# from app.core.ai.yolo_plugin import YoloPlugin
from app.core.ai.models import FrameEnvelope
from app.core.rules.engine import RulesEngine
from app.core.camera.manager import CameraManager

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    def __init__(self, session_maker: sessionmaker):
        self.session_maker = session_maker
        self.hub = FrameHub()
        self.camera_manager = CameraManager()
        self.active_tasks: Dict[uuid.UUID, asyncio.Task] = {}
        self.active_plugins: Dict[uuid.UUID, Any] = {}
        self._running = False

    async def start(self):
        """Starts the orchestrator background service."""
        logger.info("Starting Pipeline Orchestrator...")
        self._running = True
        
        # On startup, we fetch all active cameras from the database
        async with self.session_maker() as db:
            from app.models.camera import Camera
            from sqlalchemy import select
            result = await db.execute(select(Camera))
            cameras = result.scalars().all()
            
        for camera in cameras:
            await self._start_camera_pipeline(camera)

    async def stop(self):
        """Stops the orchestrator and all pipelines."""
        logger.info("Stopping Pipeline Orchestrator...")
        self._running = False
        
        for task in self.active_tasks.values():
            task.cancel()
            
        # Give tasks a moment to clean up
        await asyncio.sleep(0.5)
        self.active_tasks.clear()
        
        # Stop all plugins
        # for plugin in self.active_plugins.values():
        #     plugin.stop()
        self.active_plugins.clear()

    async def _start_camera_pipeline(self, camera: Any):
        """Initializes the capture and starts the AI processing task for a camera."""
        # 1. Start the camera capture (runs in its own thread via CameraManager)
        self.camera_manager.start_stream(camera.id, camera.stream_path, camera.stream_profile)
        
        # 2. Subscribe to FrameHub for this camera
        queue = self.hub.subscribe(
            camera_id=camera.id, 
            consumer_name="yolo-primary", 
            strategy=ConsumerStrategy.LATEST, 
            max_size=5
        )
        
        # 3. Initialize AI Plugin
        # plugin = YoloPlugin(camera.id)
        # plugin.initialize()
        plugin = None
        # Note: We let it lazy-load on the first frame to not block startup
        self.active_plugins[camera.id] = plugin
        
        # 4. Start background processing loop for this camera
        task = asyncio.create_task(self._process_loop(camera.id, plugin, queue))
        self.active_tasks[camera.id] = task
        logger.info(f"Pipeline started for camera {camera.id}")

    async def _process_loop(self, camera_id: uuid.UUID, plugin: Any, queue: Any):
        """
        Background loop pulling frames from the hub, processing via AI, 
        and feeding results into the Rules Engine.
        """
        logger.info(f"Process loop starting for {camera_id}")
        while self._running:
            try:
                # Use to_thread because queue.get is blocking
                frame_data, metadata = await asyncio.to_thread(queue.get, timeout=1.0)
                
                if frame_data is None:
                    # Timeout reached, continue looping
                    continue
                    
                # We have a frame! Let's build the envelope and process it
                envelope = FrameEnvelope(metadata=metadata, frame_data=frame_data)
                
                # Run AI Plugin (blocking call, so we push it to a thread)
                # In a high performance system, this might go to a GPU worker pool.
                # detections = await asyncio.to_thread(plugin.process, envelope)
                detections = []
                
                if not detections:
                    continue
                    
                # We have detections! Feed them to the RulesEngine
                async with self.session_maker() as db:
                    for detection in detections:
                        events = await RulesEngine.evaluate(db, detection)
                        if events:
                            await db.commit() # Commit the new events to DB
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pipeline loop for camera {camera_id}: {e}", exc_info=True)
                await asyncio.sleep(1) # Backoff on error
                
        logger.info(f"Process loop exited for {camera_id}")
