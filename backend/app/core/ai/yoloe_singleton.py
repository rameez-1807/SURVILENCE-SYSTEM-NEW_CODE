"""
AI Surveillance System - YOLOE Open-Vocabulary Singleton Detector

Loads a YOLOE prompt-free checkpoint ONCE at startup and exposes
a `detect_frame()` function for high-performance per-frame inference.

This is used for the browser webcam open-vocabulary live detection WebSocket.
The existing YOLO11m singleton and RTSP pipeline are NOT affected.
"""

import logging
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Thread-safe singleton state
# ---------------------------------------------------------------------------
_model_lock = threading.Lock()
_model = None
_model_names: Dict[int, str] = {}
_device: str = "cpu"
_loaded: bool = False

# Default checkpoint — Ultralytics will auto-download if missing
_DEFAULT_CHECKPOINT = "yoloe-11s-seg-pf.pt"


def _resolve_model_path() -> str:
    """Resolve YOLOE model path from settings, falling back to models/ dir."""
    try:
        from app.core.config import settings
        cfg_path = getattr(settings, "YOLOE_MODEL_PATH", None)
        if cfg_path:
            p = Path(cfg_path)
            if p.is_absolute():
                return str(p)
            # Relative to backend dir
            backend_dir = Path(__file__).resolve().parents[3]
            candidate = backend_dir / cfg_path
            if candidate.exists():
                return str(candidate)
            return str(cfg_path)  # Let Ultralytics handle it
    except Exception:
        pass

    # Default: <project_root>/models/<checkpoint>
    models_dir = Path(__file__).resolve().parents[4] / "models"
    candidate = models_dir / _DEFAULT_CHECKPOINT
    if candidate.exists():
        return str(candidate)

    # Fallback: just the checkpoint name — Ultralytics auto-downloads
    return _DEFAULT_CHECKPOINT


def _resolve_device() -> str:
    """Pick CUDA if available, otherwise CPU."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[YOLOE] CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    return "cpu"


def load_model() -> None:
    """
    Load the YOLOE model into memory. Thread-safe, idempotent.
    Call this at startup to warm the model before first request.
    """
    global _model, _model_names, _device, _loaded

    with _model_lock:
        if _loaded:
            return

        model_path = _resolve_model_path()
        _device = _resolve_device()

        logger.info(f"[YOLOE] Loading open-vocabulary model from '{model_path}' on '{_device}'...")
        start = time.perf_counter()

        try:
            from ultralytics import YOLO

            _model = YOLO(model_path)

            # Move to target device
            if _device != "cpu":
                try:
                    _model.to(_device)
                except Exception as e:
                    logger.warning(f"[YOLOE] Failed to move to {_device}, falling back to CPU: {e}")
                    _device = "cpu"

            # Cache class names
            if hasattr(_model, "names"):
                _model_names = (
                    _model.names
                    if isinstance(_model.names, dict)
                    else {i: n for i, n in enumerate(_model.names)}
                )
            else:
                _model_names = {}

            _loaded = True
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(
                f"[YOLOE] Model loaded successfully on {_device} "
                f"in {elapsed:.0f}ms ({len(_model_names)} classes)"
            )

        except ImportError:
            logger.error("[YOLOE] ultralytics package is required. Install: pip install -U ultralytics")
            raise
        except Exception as e:
            logger.error(f"[YOLOE] Failed to load model: {e}")
            raise


def detect_frame(
    frame: np.ndarray,
    confidence: float = 0.45,
    iou: float = 0.45,
    imgsz: int = 640,
) -> Dict:
    """
    Run YOLOE inference on a single BGR numpy frame.

    Returns dict with:
      - detections: list of {class_id, name, confidence, x1, y1, x2, y2}
      - counts: dict mapping class name -> count
      - model: str
      - inference_ms: float
      - frame_width: int
      - frame_height: int
      - timestamp: float
    """
    global _model, _model_names, _device

    # Ensure model is loaded (safety fallback)
    if not _loaded or _model is None:
        load_model()

    empty_result = {
        "detections": [],
        "counts": {},
        "model": "yoloe",
        "inference_ms": 0,
        "frame_width": 0,
        "frame_height": 0,
        "timestamp": time.time(),
    }

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return empty_result

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
            logger.error(f"[YOLOE] GPU OOM, falling back to CPU: {e}")
            _device = "cpu"
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass
            empty_result["frame_width"] = img_w
            empty_result["frame_height"] = img_h
            return empty_result
        raise
    except Exception as e:
        logger.error(f"[YOLOE] Inference error: {e}")
        empty_result["frame_width"] = img_w
        empty_result["frame_height"] = img_h
        return empty_result

    elapsed_ms = (time.perf_counter() - start) * 1000

    detections: List[Dict] = []
    counts: Dict[str, int] = {}

    if results and len(results) > 0:
        result = results[0]
        boxes = result.boxes

        for box in boxes:
            raw_xyxy = box.xyxy[0]
            x1, y1, x2, y2 = (
                raw_xyxy.tolist() if hasattr(raw_xyxy, "tolist") else list(raw_xyxy)
            )
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = _model_names.get(cls_id, f"class_{cls_id}")

            detections.append({
                "class_id": cls_id,
                "name": cls_name,
                "confidence": round(conf, 4),
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "x2": round(x2, 1),
                "y2": round(y2, 1),
            })

            counts[cls_name] = counts.get(cls_name, 0) + 1

    return {
        "detections": detections,
        "counts": counts,
        "model": "yoloe",
        "inference_ms": round(elapsed_ms, 2),
        "frame_width": img_w,
        "frame_height": img_h,
        "timestamp": time.time(),
    }


def is_loaded() -> bool:
    """Check if the model is currently loaded."""
    return _loaded


def get_class_names() -> Dict[int, str]:
    """Return the class name mapping."""
    return dict(_model_names)
