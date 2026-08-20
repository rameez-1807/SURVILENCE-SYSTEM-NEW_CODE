"""
AI Surveillance System - YOLOv8 Object Detection Plugin

Production-ready YOLO detector with:
- Configurable model path, confidence, IoU, image size, class filtering
- Automatic GPU/CPU device selection with CUDA fallback
- Single model load (never reloads per frame)
- torch.no_grad() inference mode
- Frame sampling support
- Structured logging and latency metrics
"""

import logging
import time
import uuid
from typing import List, Optional, Set

import numpy as np

from app.core.ai.models import DetectionResult, FrameEnvelope, PluginManifest
from app.core.ai.plugin import AIPlugin
from app.core.config import settings

logger = logging.getLogger(__name__)


def _resolve_device(device_str: str) -> str:
    """Resolve 'auto' device to the best available backend."""
    if device_str != "auto":
        return device_str
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    logger.info("No CUDA GPU available, falling back to CPU")
    return "cpu"


class YoloPlugin(AIPlugin):
    """
    YOLOv8-based object detection plugin.
    Lazy-loads the model once and reuses it for high-performance inference.
    All parameters are read from app settings (environment-configurable).
    """

    def __init__(
        self,
        camera_id: uuid.UUID,
        model_path: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
        inference_size: Optional[int] = None,
        sample_every_n_frames: Optional[int] = None,
        device: Optional[str] = None,
        class_filter: Optional[Set[str]] = None,
    ):
        super().__init__(camera_id)
        # Read from settings with optional overrides
        self.model_path = model_path or settings.DETECTION_MODEL_PATH
        self.confidence_threshold = confidence_threshold if confidence_threshold is not None else settings.DETECTION_CONFIDENCE
        self.iou_threshold = iou_threshold if iou_threshold is not None else settings.DETECTION_IOU
        self.inference_size = inference_size if inference_size is not None else settings.DETECTION_IMAGE_SIZE
        self.sample_every_n_frames = sample_every_n_frames if sample_every_n_frames is not None else settings.DETECTION_FRAME_SKIP
        self.device_str = device or settings.DETECTION_DEVICE

        # Parse class filter from settings if not provided
        if class_filter is not None:
            self.class_filter = class_filter
        elif settings.DETECTION_CLASS_FILTER.strip():
            self.class_filter = {c.strip().lower() for c in settings.DETECTION_CLASS_FILTER.split(",") if c.strip()}
        else:
            self.class_filter = set()  # empty = accept all

        self.model = None
        self.resolved_device = "cpu"
        self._frames_processed = 0
        self._total_latency = 0.0
        self._last_inference_ms = 0.0

    def initialize(self) -> None:
        """Sets up the plugin manifest."""
        self.manifest = PluginManifest(
            id="yolo-v8-object-detector",
            name="YOLOv8 Object Detector",
            version="1.0.0",
            description=f"YOLO detection using {self.model_path} on {self.device_str}.",
            supported_architectures=["cpu", "gpu", "cuda"]
        )

    def load(self) -> None:
        """Lazy load the YOLO model once. Never call per frame."""
        if self.model is not None:
            return

        self.resolved_device = _resolve_device(self.device_str)
        logger.info(
            f"Loading YOLO model '{self.model_path}' on device '{self.resolved_device}' "
            f"(conf={self.confidence_threshold}, iou={self.iou_threshold}, "
            f"imgsz={self.inference_size}, skip={self.sample_every_n_frames})"
        )

        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)

            # Force model to target device
            if self.resolved_device != "cpu":
                try:
                    self.model.to(self.resolved_device)
                except Exception as e:
                    logger.warning(f"Failed to move model to {self.resolved_device}, falling back to CPU: {e}")
                    self.resolved_device = "cpu"

            logger.info(f"Model '{self.model_path}' loaded successfully on {self.resolved_device}.")
        except ImportError:
            logger.error("ultralytics package is required for YoloPlugin. Install with: pip install ultralytics")
            raise
        except Exception as e:
            logger.error(f"Failed to load YOLO model '{self.model_path}': {e}")
            raise

    def process(self, envelope: FrameEnvelope) -> List[DetectionResult]:
        """
        Runs YOLO inference on the provided frame.
        Uses torch.no_grad() for inference-only execution.
        """
        # Ensure model is loaded (lazy safety check)
        if self.model is None:
            self.load()

        frame_data = envelope.frame_data

        # Frame sampling: skip frames based on configured interval
        if self.sample_every_n_frames > 1 and envelope.metadata.frame_id % self.sample_every_n_frames != 0:
            return []

        # Validate frame
        if not isinstance(frame_data, np.ndarray):
            logger.warning("Frame data is not a numpy array. Skipping.")
            return []

        if frame_data.size == 0:
            logger.warning("Empty frame received. Skipping.")
            return []

        img_h, img_w = frame_data.shape[:2]
        if img_h < 10 or img_w < 10:
            logger.warning(f"Frame too small ({img_w}x{img_h}). Skipping.")
            return []

        start_time = time.perf_counter()

        try:
            # Run inference with no_grad for performance
            import torch
            with torch.no_grad():
                results = self.model.predict(
                    source=frame_data,
                    conf=self.confidence_threshold,
                    iou=self.iou_threshold,
                    imgsz=self.inference_size,
                    device=self.resolved_device,
                    verbose=False,
                )
        except RuntimeError as e:
            # Handle GPU OOM gracefully
            if "out of memory" in str(e).lower():
                logger.error(f"GPU out of memory during inference. Falling back to CPU. Error: {e}")
                self.resolved_device = "cpu"
                try:
                    import torch
                    torch.cuda.empty_cache()
                except Exception:
                    pass
                return []
            raise
        except Exception as e:
            logger.error(f"YOLO inference error: {e}")
            return []

        end_time = time.perf_counter()
        processing_time_ms = (end_time - start_time) * 1000.0

        self._frames_processed += 1
        self._total_latency += processing_time_ms
        self._last_inference_ms = processing_time_ms

        detections = []
        if results and len(results) > 0:
            result = results[0]
            boxes = result.boxes

            for box in boxes:
                raw_xyxy = box.xyxy[0]
                x1, y1, x2, y2 = raw_xyxy.tolist() if hasattr(raw_xyxy, "tolist") else list(raw_xyxy)
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = result.names[cls_id] if isinstance(result.names, dict) else result.names[int(cls_id)]

                # Apply class filter
                if self.class_filter and label.lower() not in self.class_filter:
                    continue

                # Normalize bounding box to [0, 1]
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
        """Returns plugin health with inference metrics."""
        status = super().health()

        avg_latency = 0.0
        if self._frames_processed > 0:
            avg_latency = self._total_latency / self._frames_processed

        status["avg_inference_latency_ms"] = round(avg_latency, 2)
        status["last_inference_ms"] = round(self._last_inference_ms, 2)
        status["frames_processed"] = self._frames_processed
        status["device"] = self.resolved_device
        status["model_path"] = self.model_path
        status["class_filter"] = list(self.class_filter) if self.class_filter else "all"
        return status
