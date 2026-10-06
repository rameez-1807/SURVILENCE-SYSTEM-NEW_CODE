"""
AI Surveillance System - YOLO-World Open-Vocabulary Singleton & ByteTrack Tracker

Loads the YOLO-World open-vocabulary model (yolov8s-worldv2.pt) ONCE at startup,
allows dynamic setting of arbitrary open-vocabulary classes (e.g. mobile phone, watch,
pen, laptop, tablet, etc.), and provides real-time ByteTrack multi-object tracking
so each physical object receives a persistent track_id across frames.
"""

import logging
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set

import numpy as np
import supervision as sv

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton state & locks
# ---------------------------------------------------------------------------
_model_lock = threading.Lock()
_model = None
_device: str = "cpu"
_loaded: bool = False
_active_classes: List[str] = []
_active_classes_tuple: Tuple[str, ...] = ()

# Default Open-Vocabulary categories
DEFAULT_OPEN_VOCAB_CLASSES = [
    "mobile phone",
    "watch",
    "pen",
    "laptop",
    "tablet",
    "person",
    "bag",
    "backpack",
    "bottle",
    "keys",
]

_DEFAULT_CHECKPOINT = "models/yolov8s-worldv2.pt"


def _resolve_model_path() -> str:
    """Resolve YOLO-World model path, checking config, models/ dir, and project root."""
    try:
        from app.core.config import settings
        cfg_path = getattr(settings, "YOLOWORLD_MODEL_PATH", None)
        if cfg_path:
            p = Path(cfg_path)
            if p.is_file():
                return str(p)
            # Try relative to backend dir or root dir
            backend_dir = Path(__file__).resolve().parents[3]
            candidate = backend_dir / cfg_path
            if candidate.is_file():
                return str(candidate)
            candidate_root = backend_dir.parent / cfg_path
            if candidate_root.is_file():
                return str(candidate_root)
    except Exception:
        pass

    # Look for models/yolov8s-worldv2.pt or root yolov8s-worldv2.pt
    root_dir = Path(__file__).resolve().parents[4]
    candidate1 = root_dir / "models" / "yolov8s-worldv2.pt"
    if candidate1.is_file():
        return str(candidate1)

    candidate2 = root_dir / "yolov8s-worldv2.pt"
    if candidate2.is_file():
        return str(candidate2)

    return "yolov8s-worldv2.pt"


def _resolve_device() -> str:
    """Pick CUDA if available, otherwise CPU."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[YOLO-World] CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    return "cpu"


def load_model() -> None:
    """Load the YOLO-World model into memory. Thread-safe, idempotent."""
    global _model, _device, _loaded, _active_classes, _active_classes_tuple

    with _model_lock:
        if _loaded and _model is not None:
            return

        model_path = _resolve_model_path()
        _device = _resolve_device()

        logger.info(f"[YOLO-World] Loading open-vocabulary model from '{model_path}' on '{_device}'...")
        start = time.perf_counter()

        try:
            from ultralytics import YOLO

            _model = YOLO(model_path)

            if _device != "cpu":
                try:
                    _model.to(_device)
                except Exception as e:
                    logger.warning(f"[YOLO-World] Could not move to {_device}, fallback to CPU: {e}")
                    _device = "cpu"

            # Set default open-vocabulary classes
            set_classes_internal(DEFAULT_OPEN_VOCAB_CLASSES)

            _loaded = True
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(
                f"[YOLO-World] Model loaded successfully on {_device} in {elapsed:.0f}ms "
                f"with {len(_active_classes)} open-vocabulary classes: {_active_classes}"
            )
        except Exception as e:
            logger.error(f"[YOLO-World] Failed to load model: {e}", exc_info=True)
            raise


def set_classes_internal(classes: List[str]) -> None:
    """Set open-vocabulary classes without acquiring lock (called internally)."""
    global _model, _active_classes, _active_classes_tuple
    if not classes:
        classes = DEFAULT_OPEN_VOCAB_CLASSES

    # Normalize classes: strip whitespace and lowercase
    cleaned = [c.strip().lower() for c in classes if c and c.strip()]
    if not cleaned:
        cleaned = DEFAULT_OPEN_VOCAB_CLASSES

    clean_tuple = tuple(cleaned)
    if _active_classes_tuple == clean_tuple:
        return

    try:
        _model.set_classes(cleaned)
        _active_classes = list(cleaned)
        _active_classes_tuple = clean_tuple
        logger.info(f"[YOLO-World] Updated open-vocabulary classes: {_active_classes}")
    except Exception as e:
        logger.warning(f"[YOLO-World] Error updating classes: {e}")


def set_classes(classes: List[str]) -> None:
    """Public thread-safe method to update open-vocabulary classes."""
    global _model_lock
    if not _loaded or _model is None:
        load_model()
    with _model_lock:
        set_classes_internal(classes)


def get_active_classes() -> List[str]:
    """Return currently active open-vocabulary classes."""
    return list(_active_classes)


def is_loaded() -> bool:
    """Check if YOLO-World model is loaded."""
    return _loaded


# ---------------------------------------------------------------------------
# Per-Session ByteTrack Tracker
# ---------------------------------------------------------------------------
class SessionTracker:
    """
    Manages ByteTrack state and object confirmation/cooldown for a single
    WebSocket client session or camera feed.
    """

    def __init__(
        self,
        session_id: str,
        confirm_frames: int = 2,
        cooldown_seconds: float = 30.0,
    ):
        self.session_id = session_id
        self.confirm_frames = confirm_frames
        self.cooldown_seconds = cooldown_seconds

        # ByteTrack tracker via supervision
        self.tracker = sv.ByteTrack(
            track_activation_threshold=0.20,
            lost_track_buffer=30,
            minimum_matching_threshold=0.75,
            frame_rate=15,
        )

        # Track ID confirmations: track_id -> consecutive frames count
        self._track_confirmations: Dict[int, int] = {}

        # Saved tracks timestamp: (track_id, label) -> last_saved_time
        self._saved_tracks: Dict[Tuple[int, str], float] = {}

        # Last seen tracks: track_id -> timestamp
        self._last_seen: Dict[int, float] = {}

    def update(
        self,
        xyxy: np.ndarray,
        confidences: np.ndarray,
        class_ids: np.ndarray,
        class_names: List[str],
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Feed YOLO detections into ByteTrack.
        Returns:
          (tracked_detections, new_confirmed_events)
        """
        now = time.time()

        if len(xyxy) == 0:
            # Maintain track aging
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
                name = class_names[cid] if 0 <= cid < len(class_names) else f"class_{cid}"
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

                # Check temporal confirmation
                self._track_confirmations[track_id] = self._track_confirmations.get(track_id, 0) + 1
                self._last_seen[track_id] = now
                consecutive = self._track_confirmations[track_id]

                # Check cooldown debouncing
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
                    })

        # Cleanup very old track confirmations (older than 2 minutes)
        if len(self._last_seen) > 200:
            cutoff = now - 120.0
            stale_ids = [k for k, v in self._last_seen.items() if v < cutoff]
            for sid in stale_ids:
                self._last_seen.pop(sid, None)
                self._track_confirmations.pop(sid, None)
                # Purge cooldown keys for stale track
                for k in list(self._saved_tracks.keys()):
                    if k[0] == sid:
                        self._saved_tracks.pop(k, None)

        return tracked_results, new_confirmed


# Session registry: session_id -> SessionTracker
_session_trackers: Dict[str, SessionTracker] = {}
_session_lock = threading.Lock()


def get_session_tracker(session_id: str) -> SessionTracker:
    """Get or create a ByteTrack SessionTracker for a given session."""
    with _session_lock:
        if session_id not in _session_trackers:
            _session_trackers[session_id] = SessionTracker(session_id)
        return _session_trackers[session_id]


def remove_session_tracker(session_id: str) -> None:
    """Clean up SessionTracker on disconnect."""
    with _session_lock:
        _session_trackers.pop(session_id, None)


# ---------------------------------------------------------------------------
# Core Inference + Tracking Function
# ---------------------------------------------------------------------------
def track_frame(
    session_id: str,
    frame: np.ndarray,
    confidence: float = 0.35,
    iou: float = 0.45,
    imgsz: int = 640,
    classes: Optional[List[str]] = None,
) -> Dict:
    """
    Run YOLO-World open-vocabulary inference and ByteTrack tracking on a BGR frame.

    Returns:
      - detections: list of {track_id, class_id, name, confidence, x1, y1, x2, y2}
      - counts: dict of class_name -> active count
      - new_confirmed: list of newly confirmed objects eligible for database saving
      - model: "yolo-world"
      - inference_ms: float
      - frame_width: int
      - frame_height: int
      - timestamp: float
    """
    global _model, _loaded, _device

    if not _loaded or _model is None:
        load_model()

    empty_result = {
        "detections": [],
        "counts": {},
        "new_confirmed": [],
        "model": "yolo-world",
        "inference_ms": 0.0,
        "frame_width": 0,
        "frame_height": 0,
        "timestamp": time.time(),
    }

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return empty_result

    img_h, img_w = frame.shape[:2]
    empty_result["frame_width"] = img_w
    empty_result["frame_height"] = img_h

    # Update open-vocabulary classes if specified and changed
    with _model_lock:
        if classes:
            set_classes_internal(classes)
        current_classes = list(_active_classes)

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
    except Exception as e:
        logger.error(f"[YOLO-World] Inference error: {e}")
        return empty_result

    elapsed_ms = (time.perf_counter() - start) * 1000

    xyxy_list = []
    conf_list = []
    cid_list = []

    if results and len(results) > 0:
        boxes = results[0].boxes
        for box in boxes:
            raw_xyxy = box.xyxy[0]
            x1, y1, x2, y2 = raw_xyxy.tolist() if hasattr(raw_xyxy, "tolist") else list(raw_xyxy)
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])

            xyxy_list.append([x1, y1, x2, y2])
            conf_list.append(conf)
            cid_list.append(cls_id)

    xyxy_arr = np.array(xyxy_list, dtype=np.float32) if xyxy_list else np.empty((0, 4), dtype=np.float32)
    conf_arr = np.array(conf_list, dtype=np.float32) if conf_list else np.empty((0,), dtype=np.float32)
    cid_arr = np.array(cid_list, dtype=int) if cid_list else np.empty((0,), dtype=int)

    # Run session ByteTrack tracker
    session_tracker = get_session_tracker(session_id)
    tracked_dets, new_confirmed = session_tracker.update(
        xyxy=xyxy_arr,
        confidences=conf_arr,
        class_ids=cid_arr,
        class_names=current_classes,
    )

    # Build active counts
    counts: Dict[str, int] = {}
    for d in tracked_dets:
        name = d["name"]
        counts[name] = counts.get(name, 0) + 1

    return {
        "detections": tracked_dets,
        "counts": counts,
        "new_confirmed": new_confirmed,
        "model": "yolo-world",
        "inference_ms": round(elapsed_ms, 2),
        "frame_width": img_w,
        "frame_height": img_h,
        "timestamp": time.time(),
    }


def detect_frame(
    frame: np.ndarray,
    confidence: float = 0.35,
    iou: float = 0.45,
    imgsz: int = 640,
    classes: Optional[List[str]] = None,
) -> Dict:
    """Stateless detection without tracking (falls back to track_frame with a temp session)."""
    return track_frame(
        session_id="default_stateless",
        frame=frame,
        confidence=confidence,
        iou=iou,
        imgsz=imgsz,
        classes=classes,
    )
