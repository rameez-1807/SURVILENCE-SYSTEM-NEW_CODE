"""
ANPR Engine Manager.
Central registry and dispatcher for all available ANPR engines:
  - indian_anpr: Indian ANPR (fine-tuned YOLO + multi-pass OCR & Indian plate post-processing)
  - fast_alpr: FastALPR (ONNX end-to-end detector & transformer OCR)
  - yolo_easyocr: Original YOLO + EasyOCR backup engine
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Any

from app.services.anpr.base import BaseANPREngine
from app.services.anpr.indian_anpr_engine import IndianANPREngine
from app.services.anpr.fast_alpr_engine import FastALPREngine
from app.services.anpr.yolo_easyocr_engine import YOLOEasyOCREngine
from app.services.anpr.hybrid_anpr_engine import HybridANPREngine

logger = logging.getLogger(__name__)


class ANPREngineManager:
    """Singleton manager that coordinates available ANPR engines."""

    DEFAULT_ENGINE = "yolo_easyocr"

    def __init__(self):
        self._engines: Dict[str, BaseANPREngine] = {
            "yolo_easyocr": YOLOEasyOCREngine(),
            "hybrid_anpr": HybridANPREngine(),
            "indian_anpr": IndianANPREngine(),
            "fast_alpr": FastALPREngine(),
        }

    def get_engine(self, engine_id: Optional[str] = None) -> BaseANPREngine:
        """
        Retrieves requested engine by ID.
        Defaults to 'yolo_easyocr' if None or unrecognised.
        Falls back to 'yolo_easyocr' if chosen engine encounters initialization failure.
        """
        target_id = (engine_id or self.DEFAULT_ENGINE).strip().lower()
        if target_id not in self._engines:
            logger.warning(f"[ANPREngineManager] Unknown engine '{target_id}', falling back to default '{self.DEFAULT_ENGINE}'")
            target_id = self.DEFAULT_ENGINE

        return self._engines.get(target_id, self._engines["yolo_easyocr"])

    def list_engines(self) -> List[Dict[str, Any]]:
        """Returns metadata for all available engines for frontend selector."""
        return [
            {
                "id": eng.engine_id,
                "name": eng.name,
                "description": eng.description,
                "is_default": (eng.engine_id == self.DEFAULT_ENGINE)
            }
            for eng in self._engines.values()
        ]


# Global singleton instance
anpr_manager = ANPREngineManager()
