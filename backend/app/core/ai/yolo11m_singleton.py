"""
AI Surveillance System - YOLO11m Singleton Detector

Loads the YOLO11m model ONCE at module level (or on first call) and exposes
a `detect_frame()` function for high-performance per-frame inference.

This is used exclusively for the browser webcam detection endpoint.
The existing RTSP pipeline (YoloPlugin + ByteTrack) is NOT affected.
"""

import logging
import os
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# Thread-safe singleton lock
_model_lock = threading.Lock()
_model = None
_model_names: Dict[int, str] = {}
_device: str = "cpu"


def _resolve_model_path() -> str:
    """Resolve the YOLO11m model path from settings or default."""
    try:
        from app.core.config import settings
        model_path = getattr(settings, "YOLO11M_MODEL_PATH", None)
        if model_path:
            return model_path
    except Exception:
        pass
    # Default: relative to backend directory
    return str(Path(__file__).resolve().parents[2] / "models" / "yolo11m.pt")


def _resolve_device() -> str:
    """Pick CUDA if available, otherwise CPU."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[YOLO11m] CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    return "cpu"


def load_model() -> None:
    """
    Load the YOLO11m model into memory. Thread-safe, idempotent.
    Call this at startup to warm the model before first request.
    """
    global _model, _model_names, _device

    with _model_lock:
        if _model is not None:
            return  # Already loaded

        model_path = _resolve_model_path()
        _device = _resolve_device()

        logger.info(f"[YOLO11m] Loading model from '{model_path}' on device '{_device}'...")
        start = time.perf_counter()

        try:
            from ultralytics import YOLO

            _model = YOLO(model_path)

            # Move to target device
            if _device != "cpu":
                try:
                    _model.to(_device)
                except Exception as e:
                    logger.warning(f"[YOLO11m] Failed to move to {_device}, falling back to CPU: {e}")
                    _device = "cpu"

            # Cache class names
            if hasattr(_model, "names"):
                _model_names = _model.names if isinstance(_model.names, dict) else {i: n for i, n in enumerate(_model.names)}
            else:
                _model_names = {}

            elapsed = (time.perf_counter() - start) * 1000
            logger.info(f"[YOLO11m] Model loaded successfully on {_device} in {elapsed:.0f}ms ({len(_model_names)} classes)")

        except ImportError:
            logger.error("[YOLO11m] ultralytics package is required. Install: pip install ultralytics")
            raise
        except Exception as e:
            logger.error(f"[YOLO11m] Failed to load model: {e}")
            raise


def detect_frame(
    frame: np.ndarray,
    confidence: float = 0.35,
    iou: float = 0.45,
    imgsz: int = 640,
) -> Dict:
    """
    Run YOLO11m inference on a single frame (numpy BGR array).

    Returns a dict with:
      - detections: List[dict] with class_id, class_name, confidence, bbox {x1,y1,x2,y2}
      - model: str
      - inference_ms: float
      - frame_width: int
      - frame_height: int
    """
    global _model, _model_names, _device

    # Ensure model is loaded (safety fallback)
    if _model is None:
        load_model()

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return {
            "detections": [],
            "model": "yolo11m",
            "inference_ms": 0,
            "frame_width": 0,
            "frame_height": 0,
        }

    img_h, img_w = frame.shape[:2]
    start = time.perf_counter()

    try:
        import torch
        with torch.no_grad():
            results = _model.predict(
                source=frame,
                conf=confidence,
                iou=iou,
                imgsz=imgsz,
                device=_device,
                verbose=False,
            )
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            logger.error(f"[YOLO11m] GPU OOM, falling back to CPU: {e}")
            _device = "cpu"
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass
            return {
                "detections": [],
                "model": "yolo11m",
                "inference_ms": 0,
                "frame_width": img_w,
                "frame_height": img_h,
            }
        raise
    except Exception as e:
        logger.error(f"[YOLO11m] Inference error: {e}")
        return {
            "detections": [],
            "model": "yolo11m",
            "inference_ms": 0,
            "frame_width": img_w,
            "frame_height": img_h,
        }

    elapsed_ms = (time.perf_counter() - start) * 1000

    detections = []
    if results and len(results) > 0:
        result = results[0]
        boxes = result.boxes

        for box in boxes:
            raw_xyxy = box.xyxy[0]
            x1, y1, x2, y2 = raw_xyxy.tolist() if hasattr(raw_xyxy, "tolist") else list(raw_xyxy)
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = _model_names.get(cls_id, f"class_{cls_id}")

            detections.append({
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "bbox": {
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                },
            })

    return {
        "detections": detections,
        "model": "yolo11m",
        "inference_ms": round(elapsed_ms, 2),
        "frame_width": img_w,
        "frame_height": img_h,
    }


def is_loaded() -> bool:
    """Check if the model is currently loaded."""
    return _model is not None


def get_class_names() -> Dict[int, str]:
    """Return the COCO class name mapping."""
    return dict(_model_names)
