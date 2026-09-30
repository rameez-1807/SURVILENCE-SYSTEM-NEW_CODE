"""
AI Surveillance System - Live Object Detection WebSocket

Provides a lightweight WebSocket endpoint at /ws/object-detection for
real-time open-vocabulary object detection using the browser webcam.

This endpoint does NOT require JWT authentication (camera frames from the
browser are processed in-memory and never stored). The existing authenticated
WebSocket at /api/v1/ws is NOT affected.

Architecture:
  Browser webcam → base64 JPEG frame → WebSocket → YOLOE inference → JSON result
"""

import asyncio
import base64
import logging
import time

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.ai.yoloe_singleton import detect_frame as yoloe_detect, is_loaded as yoloe_is_loaded
from app.core.ai.yolo11m_singleton import detect_frame as yolo11m_detect, is_loaded as yolo11m_is_loaded

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live Object Detection WebSocket"])

# ---------------------------------------------------------------------------
# Inference configuration
# ---------------------------------------------------------------------------
def _get_detection_settings():
    """Read default detection settings from config, with safe defaults."""
    try:
        from app.core.config import settings
        return {
            "confidence": getattr(settings, "YOLOE_CONF", 0.45),
            "imgsz": getattr(settings, "YOLOE_IMGSZ", 640),
        }
    except Exception:
        return {"confidence": 0.45, "imgsz": 640}


def _decode_frame(raw_data: str) -> np.ndarray | None:
    """Decode a base64-encoded JPEG/PNG string into a BGR numpy frame."""
    try:
        if "," in raw_data:
            raw_data = raw_data.split(",", 1)[1]
        img_bytes = base64.b64decode(raw_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.debug(f"[OBJECT-DETECTION] Frame decode error: {e}")
        return None


@router.websocket("/ws/object-detection")
async def object_detection_ws(websocket: WebSocket):
    """
    Accept browser webcam frames over WebSocket and return detections.

    Protocol:
      Client sends: { "frame": "<base64 JPEG>", "model": "yolo11m" | "yoloe", "confidence": 0.45 }
      Server responds: {
        "detections": [...],
        "counts": { "person": 2, ... },
        "model": "yolo11m",
        "inference_ms": 32.1,
        "frame_width": 640,
        "frame_height": 480,
        "timestamp": 1234567890.123
      }
    """
    await websocket.accept()
    client_id = id(websocket)
    logger.info(f"[OBJECT-DETECTION] WebSocket connected (client={client_id})")

    cfg = _get_detection_settings()
    frame_count = 0

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except Exception as e:
                logger.debug(f"[OBJECT-DETECTION] Invalid message: {e}")
                await websocket.send_json({"error": "Invalid message format. Send JSON with 'frame' key."})
                continue

            raw_frame = data.get("frame")
            if not raw_frame or not isinstance(raw_frame, str):
                await websocket.send_json({"error": "Missing or invalid 'frame' field."})
                continue

            # Decode base64 frame
            frame = _decode_frame(raw_frame)
            if frame is None:
                await websocket.send_json({"error": "Could not decode image data."})
                continue

            # Client overrides
            req_model = str(data.get("model", "yolo11m")).lower()
            req_conf = data.get("confidence")
            try:
                conf = float(req_conf) if req_conf is not None else cfg["confidence"]
                conf = max(0.15, min(0.95, conf))
            except (ValueError, TypeError):
                conf = cfg["confidence"]

            frame_count += 1

            # Dispatch to target model
            try:
                if req_model == "yoloe":
                    result = await asyncio.to_thread(
                        yoloe_detect,
                        frame,
                        confidence=conf,
                        imgsz=cfg["imgsz"],
                    )
                else:
                    result = await asyncio.to_thread(
                        yolo11m_detect,
                        frame,
                        confidence=conf,
                        imgsz=cfg["imgsz"],
                    )
            except Exception as e:
                logger.error(f"[OBJECT-DETECTION] Inference exception ({req_model}): {e}")
                await websocket.send_json({"error": f"Inference error: {str(e)}"})
                continue

            if frame_count % 50 == 1:
                det_count = len(result.get("detections", []))
                logger.info(
                    f"[OBJECT-DETECTION] Frame #{frame_count} processed ({req_model}, conf={conf:.2f}) — "
                    f"{det_count} detections, {result.get('inference_ms', 0):.0f}ms"
                )

            await websocket.send_json(result)

    except WebSocketDisconnect:
        logger.info(f"[OBJECT-DETECTION] WebSocket disconnected (client={client_id}, frames={frame_count})")
    except Exception as e:
        logger.error(f"[OBJECT-DETECTION] WebSocket error: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except Exception:
            pass
