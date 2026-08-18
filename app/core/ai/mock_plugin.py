import time
import uuid
from typing import List

from app.core.ai.models import DetectionResult, FrameEnvelope, PluginManifest
from app.core.ai.plugin import AIPlugin


class MockPlugin(AIPlugin):
    """
    A mock implementation of AIPlugin for testing.
    Can be configured to simulate slow processing or specific failures.
    """
    
    def __init__(self, camera_id: uuid.UUID, fail_on_frame: int = -1, processing_time: float = 0.01):
        super().__init__(camera_id)
        self.fail_on_frame = fail_on_frame
        self.processing_time = processing_time
        
        self.latest_results: List[DetectionResult] = []

    def initialize(self) -> None:
        self.manifest = PluginManifest(
            id="mock-plugin-v1",
            name="Mock AI Detector",
            version="1.0.0",
            description="Simulates AI detection for testing isolation.",
            supported_architectures=["cpu"]
        )

    def load(self) -> None:
        # Simulate loading weights
        time.sleep(0.1)

    def process(self, envelope: FrameEnvelope) -> List[DetectionResult]:
        # Simulate processing time
        time.sleep(self.processing_time)
        
        # Simulate crash
        if self.fail_on_frame != -1 and envelope.metadata.frame_id == self.fail_on_frame:
            raise RuntimeError(f"Simulated plugin crash on frame {self.fail_on_frame}")
            
        result = DetectionResult(
            camera_id=envelope.metadata.camera_id,
            frame_id=envelope.metadata.frame_id,
            observed_at=envelope.metadata.timestamp,
            confidence=0.99,
            bounding_box=[10.0, 10.0, 100.0, 100.0],
            model_id=self.manifest.id,
            model_version=self.manifest.version,
            processing_time_ms=self.processing_time * 1000.0,
            label="person"
        )
        return [result]

    def _handle_results(self, results: List[DetectionResult]) -> None:
        self.latest_results = results
