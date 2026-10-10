"""
AI Surveillance System - Live Object Detection & ByteTrack Tracking WebSocket

Provides a real-time WebSocket endpoint at /ws/object-detection for
open-vocabulary object detection (YOLO-World) and YOLO11m with ByteTrack tracking.

Supports:
- Dynamic open-vocabulary classes (e.g., mobile phone, watch, pen, laptop, tablet, etc.)
- Stable multi-object tracking (ByteTrack) assigning persistent track_id per physical object
- Deduplicated persistence: newly confirmed tracks are logged to Supabase/PostgreSQL without spamming
"""

import asyncio
import base64
import logging
import time
from typing import List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.ai.yoloworld_singleton import (
    track_frame as yoloworld_track_frame,
    remove_session_tracker,
    get_active_classes,
)
from app.core.ai.yolo11m_singleton import (
    detect_frame as yolo11m_detect,
    is_loaded as yolo11m_is_loaded,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live Object Detection WebSocket"])


def _get_detection_settings():
    """Read default detection settings from config, with safe defaults."""
    try:
        from app.core.config import settings
        return {
            "confidence": getattr(settings, "YOLOWORLD_CONF", 0.35),
            "imgsz": getattr(settings, "YOLOWORLD_IMGSZ", 640),
        }
    except Exception:
        return {"confidence": 0.35, "imgsz": 640}


def _decode_frame(raw_data: str) -> Optional[np.ndarray]:
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


async def _persist_confirmed_track(item: dict, camera_name: str = "Webcam Live"):
    """
    Persist confirmed object event to Supabase/PostgreSQL asynchronously.
    Deduplicated by track_id and debounced cooldown.
    """
    try:
        from app.db.session import async_session_factory
        from app.models.tenant import Tenant
        from app.models.site import Site
        from app.models.camera import Camera
        from app.models.event import Event
        from sqlalchemy import select
        from datetime import datetime, timezone
        import uuid

        async with async_session_factory() as db:
            # 1. Get or create Tenant
            tenant_stmt = select(Tenant).limit(1)
            tenant = (await db.execute(tenant_stmt)).scalar_one_or_none()
            if not tenant:
                tenant = Tenant(name="Default Surveillance Tenant")
                db.add(tenant)
                await db.commit()
                await db.refresh(tenant)

            # 2. Get or create Site
            site_stmt = select(Site).where(Site.tenant_id == tenant.id).limit(1)
            site = (await db.execute(site_stmt)).scalar_one_or_none()
            if not site:
                site = Site(name="Main Facility", tenant_id=tenant.id)
                db.add(site)
                await db.commit()
                await db.refresh(site)

            # 3. Get or create Camera
            cam_stmt = select(Camera).where(Camera.tenant_id == tenant.id).limit(1)
            cam = (await db.execute(cam_stmt)).scalar_one_or_none()
            if not cam:
                cam = Camera(
                    name=camera_name,
                    tenant_id=tenant.id,
                    site_id=site.id,
                    protocol="usb",
                    host="127.0.0.1",
                    stream_path="/live",
                    credential_reference="default"
                )
                db.add(cam)
                await db.commit()
                await db.refresh(cam)

            # 4. Insert Event
            raw_name = str(item.get("class_name", "object")).strip()
            obj_name = raw_name.lower().replace(" ", "_")
            tid = item.get("track_id")
            conf = float(item.get("confidence", 0.0))
            time_bucket = int(time.time() // 30)
            dedupe_key = f"{cam.id}_{tid}_{obj_name}_{time_bucket}"

            # Check if duplicate dedupe_key exists
            existing_stmt = select(Event).where(
                Event.tenant_id == tenant.id,
                Event.dedupe_key == dedupe_key
            ).limit(1)
            existing = (await db.execute(existing_stmt)).scalar_one_or_none()
            if existing:
                return

            event = Event(
                tenant_id=tenant.id,
                site_id=site.id,
                camera_id=cam.id,
                event_type=f"{obj_name}_detected",
                severity="medium" if conf >= 0.70 else "low",
                state="OPEN",
                observed_at=datetime.now(timezone.utc),
                confidence=conf,
                needs_review=conf < 0.45,
                is_llm_verified=False,
                model_id="yolo-world",
                model_version="v2",
                evidence_reference=f"ByteTrack #{tid}: {raw_name.title()} ({int(conf * 100)}%)",
                dedupe_key=dedupe_key,
                track_id=tid,
            )
            db.add(event)
            await db.commit()
            logger.info(f"[OBJECT-DETECTION] Confirmed track #{tid} ({raw_name}) persisted to events.")

            # Also sync directly to MongoDB Atlas Cloud
            try:
                from app.db.mongodb import get_async_db
                mongo_db = get_async_db()
                mongo_doc = {
                    "_id": str(event.id),
                    "camera_id": str(cam.id),
                    "camera_name": camera_name,
                    "event_type": f"{obj_name}_detected",
                    "object_name": raw_name,
                    "confidence": conf,
                    "track_id": tid,
                    "dedupe_key": dedupe_key,
                    "observed_at": datetime.now(timezone.utc),
                    "model_id": "yolo-world",
                    "model_version": "v2",
                    "evidence_reference": f"ByteTrack #{tid}: {raw_name.title()} ({int(conf * 100)}%)",
                    "state": "OPEN",
                    "severity": "medium" if conf >= 0.70 else "low",
                }
                await mongo_db.events.update_one(
                    {"dedupe_key": dedupe_key},
                    {"$setOnInsert": mongo_doc},
                    upsert=True
                )
                logger.info(f"[OBJECT-DETECTION] Confirmed track #{tid} synced to MongoDB Atlas 'events'")
            except Exception as me:
                logger.debug(f"[OBJECT-DETECTION] MongoDB sync error: {me}")

    except Exception as e:
        logger.debug(f"[OBJECT-DETECTION] Background persistence skipped: {e}")


@router.websocket("/ws/object-detection")
async def object_detection_ws(websocket: WebSocket):
    """
    Accept browser webcam frames over WebSocket and return open-vocabulary
    detections with ByteTrack stable tracking IDs.

    Protocol:
      Client sends:
        {
          "frame": "<base64 JPEG>",
          "model": "yoloworld" | "yoloe" | "yolo11m",
          "confidence": 0.35,
          "classes": ["mobile phone", "watch", "pen", "laptop", "tablet"],
          "auto_save": true
        }
      Server responds:
        {
          "detections": [
            { "track_id": 1, "class_id": 0, "name": "laptop", "confidence": 0.89, "x1": ..., "y1": ..., "x2": ..., "y2": ... }
          ],
          "counts": { "laptop": 1, "mobile phone": 1 },
          "active_tracks": 2,
          "new_confirmed": [...],
          "model": "yolo-world",
          "inference_ms": 32.1,
          "frame_width": 640,
          "frame_height": 480,
          "timestamp": 1234567890.123
        }
    """
    await websocket.accept()
    session_id = f"ws_{id(websocket)}"
    logger.info(f"[OBJECT-DETECTION] Client connected (session={session_id})")

    cfg = _get_detection_settings()
    frame_count = 0

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except Exception as e:
                logger.debug(f"[OBJECT-DETECTION] Invalid frame packet: {e}")
                await websocket.send_json({"error": "Invalid JSON frame payload"})
                continue

            raw_frame = data.get("frame")
            if not raw_frame or not isinstance(raw_frame, str):
                await websocket.send_json({"error": "Missing 'frame' data"})
                continue

            # Decode frame
            frame = _decode_frame(raw_frame)
            if frame is None:
                await websocket.send_json({"error": "Could not decode frame"})
                continue

            # Client overrides
            req_model = str(data.get("model", "yoloworld")).lower()
            req_conf = data.get("confidence")
            req_classes: Optional[List[str]] = data.get("classes")
            auto_save = bool(data.get("auto_save", True))

            try:
                conf = float(req_conf) if req_conf is not None else cfg["confidence"]
                conf = max(0.10, min(0.95, conf))
            except (ValueError, TypeError):
                conf = cfg["confidence"]

            frame_count += 1

            # Dispatch inference
            try:
                if req_model in ("yoloworld", "yolo-world", "yoloe", "open_vocab"):
                    # YOLO-World Open Vocabulary with ByteTrack Tracking
                    result = await asyncio.to_thread(
                        yoloworld_track_frame,
                        session_id=session_id,
                        frame=frame,
                        confidence=conf,
                        imgsz=cfg["imgsz"],
                        classes=req_classes,
                    )
                else:
                    # YOLO11m fallback
                    raw_res = await asyncio.to_thread(
                        yolo11m_detect,
                        frame,
                        confidence=conf,
                        imgsz=cfg["imgsz"],
                    )
                    result = raw_res
                    result["new_confirmed"] = []

            except Exception as e:
                logger.error(f"[OBJECT-DETECTION] Inference error ({req_model}): {e}")
                await websocket.send_json({"error": f"Inference error: {str(e)}"})
                continue

            # Trigger background debounced persistence for newly confirmed tracks
            new_confirmed = result.get("new_confirmed", [])
            if auto_save and new_confirmed:
                for item in new_confirmed:
                    asyncio.create_task(_persist_confirmed_track(item))

            result["active_tracks"] = len(result.get("detections", []))

            if frame_count % 50 == 1:
                det_count = len(result.get("detections", []))
                logger.info(
                    f"[OBJECT-DETECTION] Frame #{frame_count} ({result.get('model', req_model)}, "
                    f"conf={conf:.2f}) -> {det_count} detections, {result.get('inference_ms', 0):.0f}ms"
                )

            await websocket.send_json(result)

    except WebSocketDisconnect:
        logger.info(f"[OBJECT-DETECTION] Client disconnected (session={session_id}, frames={frame_count})")
    except Exception as e:
        logger.error(f"[OBJECT-DETECTION] WebSocket handler error: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass
    finally:
        remove_session_tracker(session_id)
