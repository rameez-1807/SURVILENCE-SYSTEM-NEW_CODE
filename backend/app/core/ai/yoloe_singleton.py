"""
AI Surveillance System - Genuine YOLOE Prompt-Free Singleton & ByteTrack Tracker

Loads the official YOLOE model (weights/yoloe-11s-seg-pf.pt) ONCE at startup
using the official Ultralytics YOLOE Python API (from ultralytics import YOLOE).

Provides zero-prompt (Prompt-Free) real-time inference and ByteTrack multi-object
tracking for live webcam streams so everyday physical objects receive accurate
bounding boxes, real object names, confidence scores, and persistent track IDs.
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
# Default Everyday Objects Vocabulary (Pre-fused for Prompt-Free inference)
# ---------------------------------------------------------------------------
EVERYDAY_CLASSES = [
    "person", "laptop", "cell phone", "bottle", "chair", "cup", "mouse", "keyboard",
    "pen", "watch", "book", "backpack", "handbag", "glasses", "remote", "scissors",
    "clock", "desk", "table", "monitor", "tv", "couch", "bed", "umbrella", "potted plant",
    "car", "bicycle", "motorcycle", "bus", "truck", "traffic light", "bench", "dog", "cat",
    "plate", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "pizza", "donut", "cake", "headphones", "keys", "notebook", "mug", "door", "window"
]

# ---------------------------------------------------------------------------
# Singleton state & locks
# ---------------------------------------------------------------------------
_model_lock = threading.Lock()
_model = None
_device: str = "cpu"
_loaded: bool = False
_active_classes: List[str] = []
_active_classes_tuple: Tuple[str, ...] = ()
_model_path_used: str = ""

_BACKEND_DIR = Path(__file__).resolve().parents[3]


def _resolve_device() -> str:
    """Pick CUDA GPU if available, otherwise CPU."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[YOLOE] CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    return "cpu"


def _resolve_model_path() -> Tuple[Path, bool]:
    """
    Resolve YOLOE model path.
    Returns (path, is_prompt_free).
    """
    try:
        from app.core.config import settings
        cfg_path = getattr(settings, "YOLOE_MODEL_PATH", None)
        if cfg_path:
            p = Path(cfg_path)
            if not p.is_absolute():
                p = _BACKEND_DIR / cfg_path
            if p.is_file():
                return p, "-pf" in p.stem.lower()
    except Exception:
        pass

    # Check weights/yoloe-11s-seg-pf.pt
    pf_candidate = _BACKEND_DIR / "weights" / "yoloe-11s-seg-pf.pt"
    if pf_candidate.is_file():
        return pf_candidate, True

    # Check weights/yoloe-11s-seg.pt (promptable official checkpoint)
    seg_candidate = _BACKEND_DIR / "weights" / "yoloe-11s-seg.pt"
    if seg_candidate.is_file():
        return seg_candidate, False

    root_seg = _BACKEND_DIR / "yoloe-11s-seg.pt"
    if root_seg.is_file():
        return root_seg, False

    return pf_candidate, True


def load_model() -> None:
    """
    Load the official YOLOE model into memory. Thread-safe, idempotent.
    Uses the genuine YOLOE API from ultralytics (not YOLO-World).
    """
    global _model, _device, _loaded, _active_classes, _active_classes_tuple, _model_path_used

    with _model_lock:
        if _loaded and _model is not None:
            return

        model_path, is_pf = _resolve_model_path()
        _device = _resolve_device()
        _model_path_used = str(model_path)

        logger.info(f"[YOLOE] Loading genuine YOLOE model from '{model_path}' on '{_device}'...")
        start = time.perf_counter()

        try:
            from ultralytics import YOLOE

            if not model_path.exists():
                # Attempt to download official asset if missing
                logger.info("[YOLOE] Model weights not found locally, downloading official yoloe-11s-seg.pt...")
                from ultralytics.utils.downloads import attempt_download_asset
                dl_path = attempt_download_asset("yoloe-11s-seg.pt")
                model_path = Path(dl_path)
                is_pf = False

            _model = YOLOE(str(model_path))

            # If this is the promptable model and not yet fused into prompt-free,
            # re-parameterize it with the rich everyday vocabulary
            head_fused = getattr(getattr(_model.model, "model", [None])[-1], "is_fused", False)
            if not is_pf and not head_fused and hasattr(_model, "get_vocab") and hasattr(_model, "set_vocab"):
                logger.info(f"[YOLOE] Re-parameterizing promptable model into Prompt-Free with {len(EVERYDAY_CLASSES)} everyday classes...")
                try:
                    vocab = _model.get_vocab(EVERYDAY_CLASSES)
                    _model.set_vocab(vocab, EVERYDAY_CLASSES)
                    logger.info("[YOLOE] Re-parameterization to Prompt-Free completed.")
                except Exception as ve:
                    logger.warning(f"[YOLOE] Vocabulary re-parameterization note: {ve}. Continuing with standard classes.")

            # Extract model class names
            if hasattr(_model, "names") and isinstance(_model.names, dict):
                _active_classes = list(_model.names.values())
            elif hasattr(_model, "names") and isinstance(_model.names, (list, tuple)):
                _active_classes = list(_model.names)
            else:
                _active_classes = list(EVERYDAY_CLASSES)

            _active_classes_tuple = tuple(_active_classes)

            if _device != "cpu":
                try:
                    _model.to(_device)
                except Exception as e:
                    logger.warning(f"[YOLOE] Could not move to {_device}, falling back to CPU: {e}")
                    _device = "cpu"

            _loaded = True
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(
                f"[YOLOE] Model loaded successfully on {_device} in {elapsed:.0f}ms. "
                f"Active classes ({len(_active_classes)}): {_active_classes[:8]}..."
            )

        except Exception as e:
            logger.error(f"[YOLOE] Failed to load genuine YOLOE model: {e}", exc_info=True)
            raise


def is_loaded() -> bool:
    """Check if YOLOE model is loaded."""
    return _loaded


def get_active_classes() -> List[str]:
    """Return currently active class names."""
    return list(_active_classes)


def get_model_info() -> Dict:
    """Return runtime metadata about the loaded YOLOE instance."""
    return {
        "model_name": "YOLOE Prompt-Free (11s)",
        "model_path": _model_path_used,
        "device": _device,
        "is_loaded": _loaded,
        "classes_count": len(_active_classes),
        "classes": _active_classes,
    }


# ---------------------------------------------------------------------------
# Per-Session ByteTrack Multi-Object Tracker
# ---------------------------------------------------------------------------
class YoloESessionTracker:
    """
    Manages ByteTrack state and object confirmation/cooldown for a single
    WebSocket client session or webcam feed using YOLOE detections.
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
        Feed YOLOE detections into ByteTrack.
        Returns:
          (tracked_detections, new_confirmed_events)
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
                name = class_names[cid] if 0 <= cid < len(class_names) else f"object_{cid}"
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
                        "model": "yoloe-pf",
                    })
        else:
            # Fallback if tracker returned empty IDs: preserve raw detections with provisional track_id=None
            for i in range(len(xyxy)):
                cid = int(class_ids[i])
                name = class_names[cid] if 0 <= cid < len(class_names) else f"object_{cid}"
                conf = float(confidences[i])
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

        # Cleanup very old track confirmations (older than 2 minutes)
        if len(self._last_seen) > 200:
            cutoff = now - 120.0
            stale_ids = [k for k, v in self._last_seen.items() if v < cutoff]
            for sid in stale_ids:
                self._last_seen.pop(sid, None)
                self._track_confirmations.pop(sid, None)
                for k in list(self._saved_tracks.keys()):
                    if k[0] == sid:
                        self._saved_tracks.pop(k, None)

        return tracked_results, new_confirmed


# Session registry: session_id -> (tracker, last_active_timestamp)
_session_trackers: Dict[str, Tuple[YoloESessionTracker, float]] = {}
_session_lock = threading.Lock()
_yoloe_frame_counter = 0


def get_session_tracker(session_id: str) -> YoloESessionTracker:
    """Get or create a ByteTrack YoloESessionTracker, pruning expired sessions."""
    now = time.time()
    with _session_lock:
        # Periodic TTL cleanup of stale sessions older than 60s to prevent session leakage
        if len(_session_trackers) > 5:
            stale = [sid for sid, (_, last_seen) in _session_trackers.items() if (now - last_seen) > 60.0]
            for sid in stale:
                _session_trackers.pop(sid, None)

        if session_id not in _session_trackers:
            # Bound maximum simultaneous session trackers
            if len(_session_trackers) >= 20:
                oldest_sid = min(_session_trackers.keys(), key=lambda k: _session_trackers[k][1])
                _session_trackers.pop(oldest_sid, None)
            _session_trackers[session_id] = (YoloESessionTracker(session_id), now)
        else:
            tracker, _ = _session_trackers[session_id]
            _session_trackers[session_id] = (tracker, now)
        return _session_trackers[session_id][0]


def remove_session_tracker(session_id: str) -> None:
    """Clean up YoloESessionTracker on disconnect."""
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
    Run genuine YOLOE Prompt-Free inference and ByteTrack tracking on a BGR frame.

    Returns:
      - detections: list of {track_id, class_id, name, confidence, x1, y1, x2, y2}
      - counts: dict of class_name -> active count
      - new_confirmed: list of newly confirmed objects eligible for database saving
      - model: "yoloe-pf"
      - inference_ms: float
      - frame_width: int
      - frame_height: int
      - timestamp: float
    """
    global _model, _loaded, _device

    empty_result = {
        "detections": [],
        "counts": {},
        "new_confirmed": [],
        "model": "yoloe-pf",
        "inference_ms": 0.0,
        "frame_width": 0,
        "frame_height": 0,
        "timestamp": time.time(),
    }

    if not _loaded or _model is None:
        load_model()
    if _model is None:
        return empty_result

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return empty_result

    img_h, img_w = frame.shape[:2]
    empty_result["frame_width"] = img_w
    empty_result["frame_height"] = img_h

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
        logger.error(f"[YOLOE] Inference error: {e}", exc_info=True)
        return empty_result

    elapsed_ms = (time.perf_counter() - start) * 1000

    xyxy_list = []
    conf_list = []
    cid_list = []

    if results and len(results) > 0:
        boxes = results[0].boxes
        if boxes is not None and len(boxes) > 0:
            for box in boxes:
                raw_xyxy = box.xyxy[0]
                x1, y1, x2, y2 = raw_xyxy.tolist() if hasattr(raw_xyxy, "tolist") else list(raw_xyxy)
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])

                xyxy_list.append([x1, y1, x2, y2])
                conf_list.append(conf)
                cid_list.append(cls_id)

    # Free Ultralytics results and tensor memory immediately
    del results

    global _yoloe_frame_counter
    _yoloe_frame_counter += 1
    if _yoloe_frame_counter % 90 == 0:
        import gc
        gc.collect()
        if _device != "cpu":
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass

    xyxy_arr = np.array(xyxy_list, dtype=np.float32) if xyxy_list else np.empty((0, 4), dtype=np.float32)
    conf_arr = np.array(conf_list, dtype=np.float32) if conf_list else np.empty((0,), dtype=np.float32)
    cid_arr = np.array(cid_list, dtype=int) if cid_list else np.empty((0,), dtype=int)

    # Run ByteTrack tracking
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
        "model": "yoloe-pf",
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
    """Stateless detection without tracking."""
    return track_frame(
        session_id="default_yoloe_stateless",
        frame=frame,
        confidence=confidence,
        iou=iou,
        imgsz=imgsz,
        classes=classes,
    )


def unload_model() -> None:
    """Unload YOLOE model from memory to free RAM."""
    global _model, _loaded, _session_trackers
    with _model_lock:
        if _model is not None:
            del _model
            _model = None
            _loaded = False
            _session_trackers.clear()
            import gc
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
            logger.info("[YOLOE] Model unloaded to free RAM.")


__all__ = [
    "load_model",
    "unload_model",
    "detect_frame",
    "track_frame",
    "get_active_classes",
    "get_model_info",
    "is_loaded",
    "remove_session_tracker",
    "EVERYDAY_CLASSES",
]
