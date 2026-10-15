"""
YOLO + EasyOCR Engine Adapter (Backup Engine).
Wraps the existing surveillance system vehicle detection and OCR pipeline.
Preserves original behavior, model weights (backend/best.pt), and multi-variant thresholding.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, List
import numpy as np

from app.services.anpr.base import BaseANPREngine, ANPRDetectionResult

logger = logging.getLogger(__name__)


class YOLOEasyOCREngine(BaseANPREngine):
    """Original YOLO + EasyOCR pipeline wrapped as a modular engine."""

    @property
    def engine_id(self) -> str:
        return "yolo_easyocr"

    @property
    def name(self) -> str:
        return "YOLO + EasyOCR (Backup Engine)"

    @property
    def description(self) -> str:
        return (
            "Original surveillance system ANPR pipeline utilizing multi-class YOLO (best.pt), "
            "multi-variant adaptive contrast thresholding, and EasyOCR."
        )

    def detect_and_read(
        self,
        img_bgr: np.ndarray,
        is_live_stream: bool = False
    ) -> ANPRDetectionResult:
        """Invokes the existing VehicleService detection & OCR pipeline."""
        t0 = time.perf_counter()
        
        # Import lazily to avoid circular imports
        from app.services.vehicle import VehicleService

        try:
            det = VehicleService._detect_and_read_plate(img_bgr, is_live_stream=is_live_stream)
        except Exception as e:
            logger.error(f"[YOLO_EasyOCR] Detection error: {e}", exc_info=True)
            det = {
                "plate": "",
                "vehicle_type": "car",
                "confidence": 0.0,
                "bounding_box": None,
                "cropped_plate_base64": None,
                "is_valid_format": False,
                "raw_ocr_text": None
            }

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        bbox = det.get("bounding_box")
        crop_b64 = det.get("cropped_plate_base64")
        return ANPRDetectionResult(
            plate=str(det.get("plate") or ""),
            raw_plate=str(det.get("raw_ocr_text") or det.get("plate") or ""),
            confidence=float(det.get("confidence") or 0.0),
            vehicle_type=str(det.get("vehicle_type") or "car"),
            bounding_box=bbox if isinstance(bbox, list) else None,
            cropped_plate_base64=str(crop_b64) if crop_b64 else None,
            is_valid_format=bool(det.get("is_valid_format", False)),
            engine=self.engine_id,
            processing_time_ms=elapsed_ms
        )


# Backward-compatible alias
YOLOEaspyOCREngine = YOLOEasyOCREngine

