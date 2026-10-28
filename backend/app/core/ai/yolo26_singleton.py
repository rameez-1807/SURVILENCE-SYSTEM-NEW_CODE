"""YOLO26s detector adapter for the existing live WebSocket + ByteTrack pipeline.

- Lazy-loads one Ultralytics YOLO26s model (PyTorch or exported ONNX).
- Uses the same event-confirmation logic as existing YOLOE tracking, but maintains
  separate per-session tracker state and emits the correct model identifier.
- Does not affect the legacy RTSP pipeline or other available model choices.

Configure YOLO26_MODEL_PATH=yolo26s.pt (default) or an absolute/local .onnx path.
This model detects its trained classes; it is NOT open-vocabulary.
"""

import logging
import os
import threading
import time
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from app.core.ai.yoloe_singleton import YoloESessionTracker

logger = logging.getLogger(__name__)
_BACKEND_DIR = Path(__file__).resolve().parents[3]

_model = None
_model_names: List[str] = []
_model_lock = threading.Lock()
_inference_lock = threading.Lock()
_tracker_lock = threading.Lock()
_session_trackers: Dict[str, Tuple[YoloESessionTracker, float]] = {}


def _model_path() -> str:
    requested = os.environ.get("YOLO26_MODEL_PATH", "yolo26s.pt").strip() or "yolo26s.pt"
    candidate = Path(requested)
    if candidate.is_file():
        return str(candidate)
    backend_candidate = _BACKEND_DIR / requested
    if backend_candidate.is_file():
        return str(backend_candidate)
    # Only official weight names should auto-download; configured ONNX models
    # must exist locally (the export step is a separate operation).
    if requested.lower().endswith(".onnx"):
        raise FileNotFoundError(f"YOLO26 ONNX model not found: {requested}")
    return requested


def load_model() -> None:
    global _model, _model_names
    with _model_lock:
        if _model is not None:
            return
        from ultralytics import YOLO

        path = _model_path()
        logger.info("[YOLO26] Loading %s on CPU", path)
        model = YOLO(path)
        names = model.names
        if isinstance(names, dict):
            _model_names = [str(names.get(i, f"class_{i}")) for i in range(max(names, default=-1) + 1)]
        else:
            _model_names = [str(n) for n in names]
        _model = model
        logger.info("[YOLO26] Loaded model with %d categories", len(_model_names))


def is_loaded() -> bool:
    return _model is not None


def _get_tracker(session_id: str) -> YoloESessionTracker:
    now = time.monotonic()
    with _tracker_lock:
        stale = [sid for sid, (_, seen) in _session_trackers.items() if now - seen > 120]
        for sid in stale:
            _session_trackers.pop(sid, None)
        if session_id not in _session_trackers:
            if len(_session_trackers) >= 20:
                oldest = min(_session_trackers, key=lambda sid: _session_trackers[sid][1])
                _session_trackers.pop(oldest, None)
            _session_trackers[session_id] = (YoloESessionTracker(session_id), now)
        tracker, _ = _session_trackers[session_id]
        _session_trackers[session_id] = (tracker, now)
        return tracker


def remove_session_tracker(session_id: str) -> None:
    with _tracker_lock:
        _session_trackers.pop(session_id, None)


def track_frame(
    session_id: str,
    frame: np.ndarray,
    confidence: float = 0.35,
    imgsz: int = 640,
) -> dict:
    """Return the same response contract as YOLOE's existing WebSocket adapter."""
    width = int(frame.shape[1]) if isinstance(frame, np.ndarray) and frame.ndim >= 2 else 0
    height = int(frame.shape[0]) if isinstance(frame, np.ndarray) and frame.ndim >= 2 else 0
    empty = {
        "detections": [], "counts": {}, "new_confirmed": [],
        "model": "yolo26s", "inference_ms": 0.0,
        "frame_width": width, "frame_height": height, "timestamp": time.time(),
    }
    if not isinstance(frame, np.ndarray) or frame.size == 0 or width < 10 or height < 10:
        return empty

    # Ultralytics predictor initialization and inference are serialized. The
    # trackers remain isolated by WebSocket session, not globally shared.
    with _inference_lock:
        if _model is None:
            load_model()
        begin = time.perf_counter()
        predictions = _model.predict(
            source=frame, conf=confidence, imgsz=imgsz,
            device="cpu", verbose=False,
        )
        elapsed_ms = (time.perf_counter() - begin) * 1000

        boxes = predictions[0].boxes if predictions else None
        if boxes is None or len(boxes) == 0:
            coords = np.empty((0, 4), dtype=np.float32)
            scores = np.empty((0,), dtype=np.float32)
            class_ids = np.empty((0,), dtype=int)
        else:
            coords = boxes.xyxy.cpu().numpy().astype(np.float32)
            scores = boxes.conf.cpu().numpy().astype(np.float32)
            class_ids = boxes.cls.cpu().numpy().astype(int)
        class_names = list(_model_names)

    # Reuse existing, tested confirmation and cooldown rules without loading
    # the YOLOE model or sharing its per-session tracker.
    tracker = _get_tracker(session_id)
    tracked, confirmed = tracker.update(coords, scores, class_ids, class_names)
    for item in confirmed:
        item["model"] = "yolo26s"

    counts: Dict[str, int] = {}
    for item in tracked:
        label = item["name"]
        counts[label] = counts.get(label, 0) + 1

    return {
        "detections": tracked,
        "counts": counts,
        "new_confirmed": confirmed,
        "model": "yolo26s",
        "inference_ms": round(elapsed_ms, 2),
        "frame_width": width,
        "frame_height": height,
        "timestamp": time.time(),
    }


def unload_model() -> None:
    global _model, _model_names
    with _inference_lock:
        with _model_lock:
            _model = None
            _model_names = []
        with _tracker_lock:
            _session_trackers.clear()
        import gc
        gc.collect()
        logger.info("[YOLO26] Model released")
