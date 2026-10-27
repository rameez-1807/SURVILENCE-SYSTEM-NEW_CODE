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

from app.core.ai.yoloe_singleton import (
    track_frame as yoloe_track_frame,
    remove_session_tracker as yoloe_remove_session_tracker,
    is_loaded as yoloe_is_loaded,
    unload_model as yoloe_unload_model,
)
from app.core.ai.yoloworld_singleton import (
    track_frame as yoloworld_track_frame,
    remove_session_tracker as yoloworld_remove_session_tracker,
    get_active_classes,
    is_loaded as yoloworld_is_loaded,
    unload_model as yoloworld_unload_model,
)
from app.core.ai.yolo11m_singleton import (
    detect_frame as yolo11m_detect,
    is_loaded as yolo11m_is_loaded,
    unload_model as yolo11m_unload_model,
)
from app.core.ai.yolov9_singleton import (
    track_frame as yolov9_track_frame,
    detect_frame as yolov9_detect,
    is_loaded as yolov9_is_loaded,
    remove_session_tracker as yolov9_remove_session_tracker,
    unload_model as yolov9_unload_model,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live Object Detection WebSocket"])

_current_active_model: Optional[str] = None


def _evict_other_models(target_model: str) -> None:
    """Ensure only ONE model is resident in RAM at a time to stay under 512MB cloud RAM limit."""
    global _current_active_model
    if _current_active_model == target_model:
        return
    _current_active_model = target_model

    if target_model in ("yoloe", "yoloe-pf", "yoloe_autodetect", "yoloe-autodetect"):
        if yolov9_is_loaded():
            yolov9_unload_model()
        if yoloworld_is_loaded():
            yoloworld_unload_model()
        if yolo11m_is_loaded():
            yolo11m_unload_model()
    elif target_model in ("yolov9", "yolov9-c", "yolo9"):
        if yoloe_is_loaded():
            yoloe_unload_model()
        if yoloworld_is_loaded():
            yoloworld_unload_model()
        if yolo11m_is_loaded():
            yolo11m_unload_model()
    elif target_model in ("yoloworld", "yolo-world", "open_vocab"):
        if yoloe_is_loaded():
            yoloe_unload_model()
        if yolov9_is_loaded():
            yolov9_unload_model()
        if yolo11m_is_loaded():
            yolo11m_unload_model()
    elif target_model in ("yolo11m", "yolo11", "yolo11m-coco"):
        if yoloe_is_loaded():
            yoloe_unload_model()
        if yolov9_is_loaded():
            yolov9_unload_model()
        if yoloworld_is_loaded():
            yoloworld_unload_model()


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


async def _persist_confirmed_track(item: dict, camera_name: str = "Webcam Live", model_name: str = "yolo-world"):
    """
    Persist confirmed object event to Supabase/PostgreSQL asynchronously.
    Deduplicated by track_id and debounced cooldown.
    """
    # MongoDB must be written independently of PostgreSQL. In particular,
    # failing to create an SQL tenant/site must not lose the detection event.
    try:
        from datetime import datetime, timezone
        import uuid
        from app.db.mongodb import get_async_db

        raw_name = str(item.get("class_name", "object")).strip()
        obj_name = raw_name.lower().replace(" ", "_")
        tid = item.get("track_id")
        conf = float(item.get("confidence", 0.0))
        m_id = str(item.get("model", model_name))
        time_bucket = int(time.time() // 30)
        dedupe_key = f"{camera_name}_{tid}_{obj_name}_{time_bucket}"
        document = {
            "_id": str(uuid.uuid5(uuid.NAMESPACE_URL, dedupe_key)),
            "camera_name": camera_name,
            "event_type": f"{obj_name}_detected",
            "object_name": raw_name,
            "confidence": conf,
            "track_id": tid,
            "dedupe_key": dedupe_key,
            "observed_at": datetime.now(timezone.utc),
            "model_id": m_id,
            "model_version": "c" if "yolov9" in m_id.lower() else ("11m" if "11" in m_id else "v2"),
            "state": "OPEN",
            "severity": "medium" if conf >= 0.70 else "low",
        }
        await get_async_db().events.update_one(
            {"_id": document["_id"]}, {"$setOnInsert": document}, upsert=True
        )
        logger.info("[OBJECT-DETECTION] Confirmed track #%s saved to MongoDB", tid)
    except Exception as exc:
        logger.warning("[OBJECT-DETECTION] MongoDB save failed: %s", exc)

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

            m_id = str(item.get("model", model_name))
            m_ver = "c" if "yolov9" in m_id.lower() else ("11m" if "11" in m_id else "v2")

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
                model_id=m_id,
                model_version=m_ver,
                evidence_reference=f"ByteTrack #{tid}: {raw_name.title()} ({int(conf * 100)}%)",
                dedupe_key=dedupe_key,
                track_id=tid,
            )
            db.add(event)
            await db.commit()
            logger.info(f"[OBJECT-DETECTION] Confirmed track #{tid} ({raw_name}) persisted to events via {m_id}.")


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

            # Keep only the requested model in memory to prevent exceeding 512MB RAM
            _evict_other_models(req_model)

            # Dispatch inference
            target_imgsz = int(cfg["imgsz"])
            try:
                if req_model in ("yoloe", "yoloe-pf", "yoloe_autodetect", "yoloe-autodetect"):
                    # Genuine YOLOE Prompt-Free with ByteTrack Tracking (Zero-prompt Auto Detect)
                    result = await asyncio.to_thread(
                        yoloe_track_frame,
                        session_id=session_id,
                        frame=frame,
                        confidence=conf,
                        imgsz=target_imgsz,
                        classes=req_classes,
                    )
                elif req_model in ("yolov9", "yolov9-c", "yolo9"):
                    # YOLOv9-C Official Converted Model with ByteTrack Tracking
                    result = await asyncio.to_thread(
                        yolov9_track_frame,
                        session_id=session_id,
                        frame=frame,
                        confidence=conf,
                        imgsz=target_imgsz,
                    )
                elif req_model in ("yoloworld", "yolo-world", "open_vocab"):
                    # YOLO-World Open Vocabulary with ByteTrack Tracking
                    result = await asyncio.to_thread(
                        yoloworld_track_frame,
                        session_id=session_id,
                        frame=frame,
                        confidence=conf,
                        imgsz=target_imgsz,
                        classes=req_classes,
                    )
                elif req_model in ("yolo11m", "yolo11", "yolo11m-coco"):
                    # YOLO11m detector
                    raw_res = await asyncio.to_thread(
                        yolo11m_detect,
                        frame,
                        confidence=conf,
                        imgsz=target_imgsz,
                    )
                    result = raw_res
                    result["new_confirmed"] = []
                else:
                    logger.warning(f"[OBJECT-DETECTION] Unknown requested model '{req_model}'")
                    await websocket.send_json({"error": f"Unknown model '{req_model}'. Supported: yoloe, yolov9, yoloworld, yolo11m"})
                    continue

            except Exception as e:
                logger.error(f"[OBJECT-DETECTION] Inference error ({req_model}): {e}")
                await websocket.send_json({"error": f"Inference error ({req_model}): {str(e)}"})
                continue

            # Trigger background debounced persistence for newly confirmed tracks
            new_confirmed = result.get("new_confirmed", [])
            if auto_save and new_confirmed:
                m_label = result.get("model", req_model)
                for item in new_confirmed:
                    asyncio.create_task(_persist_confirmed_track(item, model_name=m_label))

            result["active_tracks"] = len(result.get("detections", []))

            if frame_count % 50 == 1:
                det_count = len(result.get("detections", []))
                logger.info(
                    f"[OBJECT-DETECTION] Frame #{frame_count} ({result.get('model', req_model)}, "
                    f"conf={conf:.2f}) -> {det_count} detections, {result.get('inference_ms', 0):.0f}ms"
                )

            await websocket.send_json(result)

            # Explicitly dereference large frame buffers and results
            del raw_frame, frame, result, data

            if frame_count % 60 == 0:
                import gc
                gc.collect()

    except WebSocketDisconnect:
        logger.info(f"[OBJECT-DETECTION] Client disconnected (session={session_id}, frames={frame_count})")
    except Exception as e:
        logger.error(f"[OBJECT-DETECTION] WebSocket handler error: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass
    finally:
        yoloe_remove_session_tracker(session_id)
        yoloworld_remove_session_tracker(session_id)
        yolov9_remove_session_tracker(session_id)
