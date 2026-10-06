"""
AI Surveillance System - Open-Vocabulary Singleton (YOLO-World)

Routes open-vocabulary inference to YOLO-World (models/yolov8s-worldv2.pt)
with ByteTrack multi-object tracking.
"""

from app.core.ai.yoloworld_singleton import (
    load_model,
    detect_frame,
    track_frame,
    set_classes,
    get_active_classes,
    is_loaded,
    remove_session_tracker,
)

__all__ = [
    "load_model",
    "detect_frame",
    "track_frame",
    "set_classes",
    "get_active_classes",
    "is_loaded",
    "remove_session_tracker",
]
