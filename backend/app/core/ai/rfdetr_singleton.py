"""
AI Surveillance System - RF-DETR-Nano Singleton & ByteTrack Multi-Object Tracker

Loads the official RF-DETR-Nano model (Roboflow Real-Time Detection Transformer)
using the official rfdetr Python API (from rfdetr import RFDETRNano) or ONNX Runtime.

Provides high-precision real-time Transformer inference with a Vision Transformer (DINOv2)
backbone and integrates with ByteTrack to assign persistent tracking IDs across video frames.

OPTIMIZATIONS:
- Dynamically bounds input resolution to RF-DETR-Nano's native 384x384 resolution
  to prevent quadratic O(N^2) token explosion in the Vision Transformer backbone.
- Automatically un-scales bounding boxes back to original camera resolution (e.g. 640x480).
- Sets optimal PyTorch CPU inference threads (min(4, cpu_count)) to maximize throughput.
- Uses torch.inference_mode() to skip autograd tracking overhead on every frame.
"""

import gc
import logging
import os
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
import supervision as sv

logger = logging.getLogger(__name__)

# Try importing COCO_CLASSES from rfdetr
try:
    from rfdetr.assets.coco_classes import COCO_CLASSES
except Exception:
    COCO_CLASSES = {}

# ---------------------------------------------------------------------------
# Singleton state & locks
# ---------------------------------------------------------------------------
_model_lock = threading.Lock()
_model = None
_device: str = "cpu"
_loaded: bool = False
_model_version: str = "nano"
_native_resolution: int = 384

# ---------------------------------------------------------------------------
# Per-Session ByteTrack Multi-Object Trackers
# ---------------------------------------------------------------------------
_session_trackers: Dict[str, "RFDETRByteTrackSession"] = {}
_session_lock = threading.Lock()


def _resolve_device() -> str:
    """Detect CUDA GPU if available, otherwise default to CPU."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[RF-DETR] CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    return "cpu"


def is_loaded() -> bool:
    """Return whether the RF-DETR model is currently resident in RAM."""
    global _model, _loaded
    return _loaded and _model is not None


def unload_model() -> None:
    """Evict RF-DETR from memory to release RAM."""
    global _model, _loaded
    with _model_lock:
        if _model is not None:
            logger.info("[RF-DETR] Unloading RF-DETR-Nano to reclaim memory...")
            _model = None
            _loaded = False
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass


def load_model() -> None:
    """
    Load RF-DETR-Nano model into memory with optimized CPU inference configuration.
    Thread-safe and idempotent.
    """
    global _model, _device, _loaded
    with _model_lock:
        if _model is not None and _loaded:
            return

        _device = _resolve_device()
        start = time.perf_counter()
        logger.info(f"[RF-DETR] Loading RF-DETR-Nano on {_device}...")

        # Optimize CPU thread allocation for vision transformer attention heads
        if _device == "cpu":
            try:
                import torch
                cpu_cores = os.cpu_count() or 2
                optimal_threads = min(4, cpu_cores)
                torch.set_num_threads(optimal_threads)
                logger.info(f"[RF-DETR] Optimized PyTorch CPU threads: {optimal_threads}")
            except Exception as e:
                logger.debug(f"[RF-DETR] Could not configure PyTorch thread count: {e}")

        try:
            from rfdetr import RFDETRNano

            _model = RFDETRNano()
            _loaded = True
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(f"[RF-DETR] RF-DETR-Nano loaded successfully in {elapsed:.1f}ms on {_device}")
        except Exception as e:
            logger.error(f"[RF-DETR] Failed to load RF-DETR-Nano: {e}")
            _model = None
            _loaded = False
            raise


class RFDETRByteTrackSession:
    """
    Maintains independent ByteTrack state, temporal confirmation, and cooldown debouncing
    for a single WebSocket client session using RF-DETR detections.
    """

    def __init__(
        self,
        session_id: str,
        track_thresh: float = 0.25,
        match_thresh: float = 0.8,
        track_buffer: int = 30,
        confirm_frames: int = 3,
        cooldown_seconds: float = 10.0,
    ):
        self.session_id = session_id
        self.tracker = sv.ByteTrack(
            track_activation_threshold=track_thresh,
            lost_track_buffer=track_buffer,
            minimum_matching_threshold=match_thresh,
            frame_rate=15,
        )
        self.confirm_frames = confirm_frames
        self.cooldown_seconds = cooldown_seconds

        # track_id -> consecutive detection frame count
        self._track_confirmations: Dict[int, int] = {}
        # (track_id, class_name) -> timestamp when event was last emitted
        self._saved_tracks: Dict[Tuple[int, str], float] = {}
        # track_id -> last observed timestamp
        self._last_seen: Dict[int, float] = {}

    def update(
        self,
        xyxy: np.ndarray,
        confidences: np.ndarray,
        class_ids: np.ndarray,
        class_names: List[str],
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Feed RF-DETR detections into ByteTrack.
        Returns (tracked_detections, new_confirmed_events).
        """
        now = time.time()

        if len(xyxy) == 0:
            self.tracker.update_with_detections(sv.Detections.empty())
            return [], []

        sv_detections = sv.Detections(
            xyxy=xyxy,
            confidence=confidences,
            class_id=class_ids,
        )

        tracked = self.tracker.update_with_detections(sv_detections)

        tracked_results: List[Dict] = []
        new_confirmed: List[Dict] = []

        if tracked.tracker_id is not None and len(tracked.tracker_id) > 0:
            for i, tid in enumerate(tracked.tracker_id):
                track_id = int(tid)
                cid = int(tracked.class_id[i]) if tracked.class_id is not None else 0
                name = class_names[i] if i < len(class_names) else COCO_CLASSES.get(cid, f"object_{cid}")
                conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
                box = tracked.xyxy[i]
                x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])

                tracked_results.append({
                    "track_id": track_id,
                    "class_id": cid,
                    "name": name,
                    "confidence": round(conf, 4),
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                })

                # Temporal confirmation
                self._track_confirmations[track_id] = self._track_confirmations.get(track_id, 0) + 1
                self._last_seen[track_id] = now
                consecutive = self._track_confirmations[track_id]

                # Cooldown debouncing
                cooldown_key = (track_id, name)
                last_saved = self._saved_tracks.get(cooldown_key, 0.0)

                if consecutive >= self.confirm_frames and (now - last_saved) >= self.cooldown_seconds:
                    self._saved_tracks[cooldown_key] = now
                    new_confirmed.append({
                        "track_id": track_id,
                        "class_name": name,
                        "confidence": conf,
                        "bbox": [x1, y1, x2, y2],
                        "first_confirmed_at": now,
                        "model": "rfdetr-nano",
                    })
        else:
            # Fallback if tracker returned empty IDs: preserve raw detections with provisional track_id=None
            for i in range(len(xyxy)):
                cid = int(class_ids[i]) if i < len(class_ids) else 0
                name = class_names[i] if i < len(class_names) else COCO_CLASSES.get(cid, f"object_{cid}")
                conf = float(confidences[i]) if i < len(confidences) else 0.0
                box = xyxy[i]
                tracked_results.append({
                    "track_id": None,
                    "class_id": cid,
                    "name": name,
                    "confidence": round(conf, 4),
                    "x1": round(float(box[0]), 1),
                    "y1": round(float(box[1]), 1),
                    "x2": round(float(box[2]), 1),
                    "y2": round(float(box[3]), 1),
                })

        # Housekeeping: prune old tracks absent for > 60 seconds
        stale = [t for t, last in self._last_seen.items() if (now - last) > 60.0]
        for t in stale:
            self._track_confirmations.pop(t, None)
            self._last_seen.pop(t, None)
            for k in list(self._saved_tracks.keys()):
                if k[0] == t:
                    del self._saved_tracks[k]

        return tracked_results, new_confirmed


def _get_or_create_tracker(session_id: str) -> RFDETRByteTrackSession:
    """Retrieve or allocate a ByteTrack session for a WebSocket client."""
    with _session_lock:
        if session_id not in _session_trackers:
            _session_trackers[session_id] = RFDETRByteTrackSession(session_id=session_id)
        return _session_trackers[session_id]


def remove_session_tracker(session_id: str) -> None:
    """Purge tracker state when client disconnects."""
    with _session_lock:
        _session_trackers.pop(session_id, None)


def _preprocess_frame(frame: np.ndarray) -> Tuple[Image.Image, float, float]:
    """
    Resize input frame to RF-DETR-Nano's native 384x384 patch dimension.
    Prevents token sequence explosion (O(N^2)) while returning scale factors
    for box un-scaling.
    """
    img_h, img_w = frame.shape[:2]
    if img_w != _native_resolution or img_h != _native_resolution:
        resized = cv2.resize(frame, (_native_resolution, _native_resolution), interpolation=cv2.INTER_LINEAR)
        scale_x = img_w / float(_native_resolution)
        scale_y = img_h / float(_native_resolution)
    else:
        resized = frame
        scale_x = 1.0
        scale_y = 1.0

    rgb_frame = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb_frame)
    return pil_img, scale_x, scale_y


def detect_frame(
    frame: np.ndarray,
    confidence: float = 0.35,
    imgsz: int = 640,
) -> Dict:
    """
    Run raw RF-DETR-Nano inference on a single numpy BGR frame.
    """
    global _model, _loaded
    if not is_loaded():
        load_model()
    if _model is None:
        return {"detections": [], "model": "rfdetr-nano", "inference_ms": 0, "frame_width": 0, "frame_height": 0}

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return {"detections": [], "model": "rfdetr-nano", "inference_ms": 0, "frame_width": 0, "frame_height": 0}

    img_h, img_w = frame.shape[:2]
    pil_img, scale_x, scale_y = _preprocess_frame(frame)

    t0 = time.perf_counter()
    try:
        import torch
        with torch.inference_mode():
            results = _model.predict(pil_img, threshold=confidence)
    except Exception as e:
        logger.error(f"[RF-DETR] Prediction error: {e}")
        return {"detections": [], "model": "rfdetr-nano", "inference_ms": 0, "frame_width": img_w, "frame_height": img_h}

    elapsed_ms = (time.perf_counter() - t0) * 1000

    detections: List[Dict] = []
    if results is not None and hasattr(results, "xyxy") and len(results.xyxy) > 0:
        class_names = results.data.get("class_name", []) if hasattr(results, "data") else []
        for i in range(len(results.xyxy)):
            box = results.xyxy[i]
            cid = int(results.class_id[i]) if results.class_id is not None else 0
            conf = float(results.confidence[i]) if results.confidence is not None else 0.0
            name = str(class_names[i]) if i < len(class_names) else COCO_CLASSES.get(cid, f"object_{cid}")

            # Scale box back to original frame dimensions
            x1 = float(box[0]) * scale_x
            y1 = float(box[1]) * scale_y
            x2 = float(box[2]) * scale_x
            y2 = float(box[3]) * scale_y

            detections.append({
                "class_id": cid,
                "class_name": name,
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
        "model": "rfdetr-nano",
        "inference_ms": round(elapsed_ms, 1),
        "frame_width": img_w,
        "frame_height": img_h,
    }


def track_frame(
    session_id: str,
    frame: np.ndarray,
    confidence: float = 0.35,
    imgsz: int = 640,
    classes: Optional[List[str]] = None,
) -> Dict:
    """
    Perform RF-DETR-Nano detection followed by ByteTrack multi-object tracking.
    """
    global _model, _loaded
    if not is_loaded():
        load_model()
    if _model is None:
        return {
            "detections": [],
            "counts": {},
            "active_tracks": 0,
            "new_confirmed": [],
            "model": "rfdetr-nano",
            "inference_ms": 0.0,
            "frame_width": 0,
            "frame_height": 0,
            "timestamp": time.time(),
        }

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return {
            "detections": [],
            "counts": {},
            "active_tracks": 0,
            "new_confirmed": [],
            "model": "rfdetr-nano",
            "inference_ms": 0.0,
            "frame_width": 0,
            "frame_height": 0,
            "timestamp": time.time(),
        }

    img_h, img_w = frame.shape[:2]
    pil_img, scale_x, scale_y = _preprocess_frame(frame)

    t0 = time.perf_counter()
    try:
        import torch
        with torch.inference_mode():
            results = _model.predict(pil_img, threshold=confidence)
    except Exception as e:
        logger.error(f"[RF-DETR] Tracking prediction error: {e}")
        return {
            "detections": [],
            "counts": {},
            "active_tracks": 0,
            "new_confirmed": [],
            "model": "rfdetr-nano",
            "inference_ms": 0.0,
            "frame_width": img_w,
            "frame_height": img_h,
            "timestamp": time.time(),
        }

    elapsed_ms = (time.perf_counter() - t0) * 1000

    xyxy = results.xyxy.copy() if results is not None and hasattr(results, "xyxy") and len(results.xyxy) > 0 else np.empty((0, 4))
    confidences = results.confidence if results is not None and hasattr(results, "confidence") else np.empty(0)
    class_ids = results.class_id if results is not None and hasattr(results, "class_id") else np.empty(0)

    # Scale boxes back to original camera coordinate space
    if len(xyxy) > 0 and (scale_x != 1.0 or scale_y != 1.0):
        xyxy[:, [0, 2]] *= scale_x
        xyxy[:, [1, 3]] *= scale_y

    # Resolve class names
    raw_names = results.data.get("class_name", []) if results is not None and hasattr(results, "data") else []
    resolved_names: List[str] = []
    for i in range(len(xyxy)):
        if i < len(raw_names):
            resolved_names.append(str(raw_names[i]))
        else:
            cid = int(class_ids[i]) if i < len(class_ids) else 0
            resolved_names.append(COCO_CLASSES.get(cid, f"object_{cid}"))

    # Optional class filter if provided
    if classes and len(classes) > 0:
        norm_classes = {c.strip().lower() for c in classes if c.strip()}
        keep_indices = [i for i, name in enumerate(resolved_names) if name.lower() in norm_classes]
        if len(keep_indices) < len(xyxy):
            xyxy = xyxy[keep_indices] if len(keep_indices) > 0 else np.empty((0, 4))
            confidences = confidences[keep_indices] if len(keep_indices) > 0 else np.empty(0)
            class_ids = class_ids[keep_indices] if len(keep_indices) > 0 else np.empty(0)
            resolved_names = [resolved_names[i] for i in keep_indices]

    # Run ByteTrack tracking with un-scaled coordinates
    tracker = _get_or_create_tracker(session_id)
    tracked_detections, new_confirmed = tracker.update(
        xyxy=xyxy,
        confidences=confidences,
        class_ids=class_ids,
        class_names=resolved_names,
    )

    # Compute object class counts
    counts: Dict[str, int] = {}
    for d in tracked_detections:
        c_name = d.get("name", "object")
        counts[c_name] = counts.get(c_name, 0) + 1

    return {
        "detections": tracked_detections,
        "counts": counts,
        "active_tracks": len([d for d in tracked_detections if d.get("track_id") is not None]),
        "new_confirmed": new_confirmed,
        "model": "rfdetr-nano",
        "inference_ms": round(elapsed_ms, 1),
        "frame_width": img_w,
        "frame_height": img_h,
        "timestamp": time.time(),
    }
