from app.services.anpr.base import BaseANPREngine, ANPRDetectionResult
from app.services.anpr.indian_anpr_engine import IndianANPREngine
from app.services.anpr.fast_alpr_engine import FastALPREngine
from app.services.anpr.yolo_easyocr_engine import YOLOEaspyOCREngine
from app.services.anpr.hybrid_anpr_engine import HybridANPREngine
from app.services.anpr.engine_manager import anpr_manager, ANPREngineManager

__all__ = [
    "BaseANPREngine",
    "ANPRDetectionResult",
    "IndianANPREngine",
    "FastALPREngine",
    "YOLOEaspyOCREngine",
    "HybridANPREngine",
    "anpr_manager",
    "ANPREngineManager",
]
