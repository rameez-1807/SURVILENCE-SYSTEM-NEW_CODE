import logging
import time
import uuid
from typing import List, Optional

import numpy as np

from app.core.ai.models import DetectionResult, FrameEnvelope, PluginManifest
from app.core.ai.plugin import AIPlugin

logger = logging.getLogger(__name__)


class YoloPlugin(AIPlugin):
    """
    YOLOv8-based object detection plugin.
    Lazy-loads the model and reuses it for high-performance inference.
    Normalizes coordinates and safely handles frame resizing.
    """

    def __init__(
        self,
        camera_id: uuid.UUID,
        model_name: str = "yolov8n.pt",
        confidence_threshold: float = 0.5,
        inference_size: Optional[int] = 640,
        sample_every_n_frames: int = 1
    ):
        super().__init__(camera_id)
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.inference_size = inference_size
        self.sample_every_n_frames = sample_every_n_frames
        
        self.model = None
        self._frames_processed = 0
        self._total_latency = 0.0

    def initialize(self) -> None:
        """Sets up the plugin manifest."""
        self.manifest = PluginManifest(
            id="yolo-v8-object-detector",
            name="YOLOv8 Object Detector",
            version="1.0.0",
            description=f"YOLO detection using {self.model_name}.",
            supported_architectures=["cpu", "gpu", "cuda"]
        )

    def load(self) -> None:
        """Lazy load the YOLO model."""
        if self.model is None:
            logger.info(f"Loading YOLO model {self.model_name}...")
            try:
                from ultralytics import YOLO
                self.model = YOLO(self.model_name)
                logger.info(f"Model {self.model_name} loaded successfully.")
            except ImportError:
                logger.error("ultralytics package is required for YoloPlugin.")
                raise

    def process(self, envelope: FrameEnvelope) -> List[DetectionResult]:
        """
        Runs YOLO inference on the provided frame.
        """
        # Ensure model is loaded (safety check)
        if self.model is None:
            self.load()
            
        frame_data = envelope.frame_data
        
        # Sampling logic (though FrameHub already drops stale frames, this allows strict sub-sampling)
        if self.sample_every_n_frames > 1 and envelope.metadata.frame_id % self.sample_every_n_frames != 0:
            return []

        start_time = time.time()
        
        # Determine image dimensions for normalization
        if not isinstance(frame_data, np.ndarray):
            logger.warning("Frame data is not a numpy array. Returning empty results.")
            return []
            
        img_h, img_w = frame_data.shape[:2]
        
        # Run inference
        results = self.model.predict(
            source=frame_data,
            conf=self.confidence_threshold,
            imgsz=self.inference_size if self.inference_size else img_w, # Ultralytics handles resize internally based on imgsz
            verbose=False
        )
        
        end_time = time.time()
        processing_time_ms = (end_time - start_time) * 1000.0
        
        self._frames_processed += 1
        self._total_latency += processing_time_ms

        detections = []
        if results and len(results) > 0:
            # results[0] contains the predictions for the first (and only) image
            result = results[0]
            boxes = result.boxes
            
            for box in boxes:
                # Get raw coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = result.names[cls_id]
                
                # Normalize bounding box [0, 1]
                nx1 = max(0.0, min(1.0, x1 / img_w))
                ny1 = max(0.0, min(1.0, y1 / img_h))
                nx2 = max(0.0, min(1.0, x2 / img_w))
                ny2 = max(0.0, min(1.0, y2 / img_h))
                
                det = DetectionResult(
                    camera_id=envelope.metadata.camera_id,
                    frame_id=envelope.metadata.frame_id,
                    observed_at=envelope.metadata.timestamp,
                    confidence=conf,
                    bounding_box=[nx1, ny1, nx2, ny2],
                    model_id=self.manifest.id,
                    model_version=self.manifest.version,
                    processing_time_ms=processing_time_ms,
                    label=label
                )
                detections.append(det)
                
        return detections

    def health(self) -> dict:
        """Returns plugin health, incorporating average inference latency."""
        status = super().health()
        
        avg_latency = 0.0
        if self._frames_processed > 0:
            avg_latency = self._total_latency / self._frames_processed
            
        status["avg_inference_latency_ms"] = avg_latency
        return status
