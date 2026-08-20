"""
AI Surveillance System - Detection Status & Real-Time Tracking API

Provides real-time pipeline telemetry, active tracks, and detection queries.
"""

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.core.pipeline.orchestrator import pipeline_orchestrator
from app.services.detection.metrics import metrics_collector

router = APIRouter(prefix="/detection", tags=["Detection Pipeline"])


@router.get("/status", response_model=Dict[str, Any])
async def get_detection_status() -> Dict[str, Any]:
    """
    Get real-time pipeline health, FPS, average & P95 latency, GPU metrics,
    active tracking counts, and global detection counters.
    """
    summary = metrics_collector.get_summary()
    summary["config"] = {
        "enabled": settings.DETECTION_ENABLED,
        "model_path": settings.DETECTION_MODEL_PATH,
        "confidence": settings.DETECTION_CONFIDENCE,
        "iou": settings.DETECTION_IOU,
        "image_size": settings.DETECTION_IMAGE_SIZE,
        "device": settings.DETECTION_DEVICE,
        "frame_skip": settings.DETECTION_FRAME_SKIP,
        "confirm_frames": settings.DETECTION_CONFIRM_FRAMES,
        "cooldown_seconds": settings.DETECTION_EVENT_COOLDOWN,
        "class_filter": settings.DETECTION_CLASS_FILTER or "all",
    }
    return summary


@router.get("/cameras/{camera_id}/tracks", response_model=List[Dict[str, Any]])
async def get_camera_active_tracks(camera_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    Get all currently tracked objects for a camera with their stable track_id,
    class name, confidence, normalized bbox, and duration.
    """
    pipeline = pipeline_orchestrator.get_pipeline(camera_id)
    if not pipeline:
        return []

    tracks = pipeline.get_active_tracks()
    return [
        {
            "track_id": t.track_id,
            "class_name": t.class_name,
            "confidence": round(t.confidence, 3),
            "bbox": t.bbox,
            "camera_id": str(t.camera_id),
            "frames_seen": t.frames_seen,
            "duration_seconds": round(t.duration_seconds(), 1),
            "timestamp": t.timestamp,
        }
        for t in tracks
    ]


@router.get("/cameras/{camera_id}/detections", response_model=List[Dict[str, Any]])
async def get_camera_latest_detections(camera_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    Get the latest raw detections from the current frame of a camera.
    """
    pipeline = pipeline_orchestrator.get_pipeline(camera_id)
    if not pipeline:
        return []

    dets = pipeline.get_latest_detections()
    return [d.model_dump(mode="json") for d in dets]
