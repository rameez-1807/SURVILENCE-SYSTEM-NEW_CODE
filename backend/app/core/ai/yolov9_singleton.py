"""
AI Surveillance System - YOLOv9-C Official Singleton Detector & ByteTrack Tracker

Loads the official YOLOv9-C converted checkpoint (yolov9-c-converted.pt) ONCE
using the official YOLOv9 architecture and exposes high-performance per-frame
detection and ByteTrack multi-object tracking for the live webcam WebSocket.
"""

import logging
import os
import sys
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set

import cv2
import numpy as np
import supervision as sv

logger = logging.getLogger(__name__)

# Ensure official YOLOv9 modules are in sys.path
_BACKEND_DIR = Path(__file__).resolve().parents[3]
_YOLOV9_ROOT = _BACKEND_DIR / "yolov9"
if str(_YOLOV9_ROOT) not in sys.path:
    sys.path.insert(0, str(_YOLOV9_ROOT))

# Thread-safe singleton state & locks
_model_lock = threading.Lock()
_model = None
_model_names: Dict[int, str] = {}
_device: str = "cpu"
_loaded: bool = False

# Per-session trackers for ByteTrack tracking
_session_trackers: Dict[str, Tuple["SessionTracker", float]] = {}
_session_lock = threading.Lock()
_yolov9_frame_counter = 0


def _resolve_model_path() -> str:
    """Resolve the YOLOv9-C converted model path."""
    try:
        from app.core.config import settings
        cfg_path = getattr(settings, "YOLOV9_MODEL_PATH", None)
        if cfg_path:
            p = Path(cfg_path)
            if p.is_file():
                return str(p)
            cand1 = _BACKEND_DIR / cfg_path
            if cand1.is_file():
                return str(cand1)
            cand2 = _BACKEND_DIR / "app" / "models" / "yolov9-c-converted.pt"
            if cand2.is_file():
                return str(cand2)
    except Exception:
        pass

    # Standard fallback paths
    default_candidates = [
        _BACKEND_DIR / "app" / "models" / "yolov9-c-converted.pt",
        _BACKEND_DIR / "models" / "yolov9-c-converted.pt",
        _BACKEND_DIR.parent / "models" / "yolov9-c-converted.pt",
    ]
    for cand in default_candidates:
        if cand.is_file():
            return str(cand)

    return str(_BACKEND_DIR / "app" / "models" / "yolov9-c-converted.pt")


def _resolve_device() -> str:
    """Pick CUDA GPU if available, otherwise CPU."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[YOLOv9] CUDA GPU detected: {gpu_name}")
            return "cuda:0"
    except Exception:
        pass
    return "cpu"


def load_model() -> None:
    """
    Load the YOLOv9-C model into memory using official YOLOv9 architecture.
    Thread-safe, idempotent.
    """
    global _model, _model_names, _device, _loaded

    with _model_lock:
        if _loaded and _model is not None:
            return

        model_path = _resolve_model_path()
        _device = _resolve_device()

        logger.info(f"[YOLOv9] Loading official YOLOv9-C model from '{model_path}' on device '{_device}'...")
        start = time.perf_counter()

        if not os.path.isfile(model_path):
            raise FileNotFoundError(f"[YOLOv9] Checkpoint file not found: {model_path}")

        try:
            import torch
            from models.experimental import attempt_load  # type: ignore

            # Multi-core CPU thread optimization
            if _device == "cpu":
                try:
                    optimal_threads = min(8, os.cpu_count() or 4)
                    torch.set_num_threads(optimal_threads)
                    logger.info(f"[YOLOv9] Optimized CPU inference with {optimal_threads} PyTorch threads")
                except Exception:
                    pass

            # Load model with official attempt_load
            _model = attempt_load(model_path, device=_device)
            _model.eval()

            # Cache class names
            if hasattr(_model, "names"):
                raw_names = _model.names
                if isinstance(raw_names, dict):
                    _model_names = {int(k): str(v) for k, v in raw_names.items()}
                elif isinstance(raw_names, (list, tuple)):
                    _model_names = {i: str(n) for i, n in enumerate(raw_names)}
                else:
                    _model_names = {}
            else:
                _model_names = {}

            # Warm-up inference pass
            try:
                warmup_img = torch.zeros((1, 3, 640, 640), device=_device)
                with torch.no_grad():
                    _ = _model(warmup_img)
            except Exception as we:
                logger.debug(f"[YOLOv9] Warmup inference note: {we}")

            _loaded = True
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(
                f"[YOLOv9] Model loaded successfully on {_device} in {elapsed:.0f}ms "
                f"({len(_model_names)} COCO classes)"
            )

        except Exception as e:
            logger.error(f"[YOLOv9] Failed to load YOLOv9 model: {e}", exc_info=True)
            raise


# ---------------------------------------------------------------------------
# Per-Session ByteTrack Tracker for YOLOv9
# ---------------------------------------------------------------------------
class SessionTracker:
    """
    Manages ByteTrack state and object confirmation/cooldown for a single
    WebSocket client session.
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

        self.tracker = sv.ByteTrack(
            track_activation_threshold=0.20,
            lost_track_buffer=30,
            minimum_matching_threshold=0.75,
            frame_rate=15,
        )
        self._track_confirmations: Dict[int, int] = {}
        self._saved_tracks: Dict[Tuple[int, str], float] = {}
        self._last_seen: Dict[int, float] = {}

    def update(
        self,
        xyxy: np.ndarray,
        confidences: np.ndarray,
        class_ids: np.ndarray,
        class_names: Dict[int, str],
    ) -> Tuple[List[Dict], List[Dict]]:
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
                name = class_names.get(cid, f"class_{cid}")
                conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
                box = tracked.xyxy[i]
                x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])

                det_obj = {
                    "track_id": track_id,
                    "class_id": cid,
                    "class_name": name,
                    "name": name,
                    "confidence": round(conf, 4),
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                    "bbox": {
                        "x1": round(x1, 1),
                        "y1": round(y1, 1),
                        "x2": round(x2, 1),
                        "y2": round(y2, 1),
                    },
                }
                tracked_results.append(det_obj)

                # Count consecutive appearances
                self._track_confirmations[track_id] = self._track_confirmations.get(track_id, 0) + 1
                self._last_seen[track_id] = now

                # If confirmed for N consecutive frames and cooldown elapsed
                if self._track_confirmations[track_id] >= self.confirm_frames:
                    key = (track_id, name)
                    last_saved = self._saved_tracks.get(key, 0.0)
                    if (now - last_saved) >= self.cooldown_seconds:
                        self._saved_tracks[key] = now
                        new_confirmed.append(det_obj)

        # Cleanup stale tracks older than 60 seconds
        stale = [t for t, t_time in self._last_seen.items() if (now - t_time) > 60.0]
        for t in stale:
            self._track_confirmations.pop(t, None)
            self._last_seen.pop(t, None)
            for k in list(self._saved_tracks.keys()):
                if k[0] == t:
                    self._saved_tracks.pop(k, None)

        return tracked_results, new_confirmed


def get_or_create_tracker(session_id: str) -> SessionTracker:
    now = time.time()
    with _session_lock:
        # Periodic TTL cleanup of stale sessions older than 60s
        if len(_session_trackers) > 5:
            stale = [sid for sid, (_, last_seen) in _session_trackers.items() if (now - last_seen) > 60.0]
            for sid in stale:
                _session_trackers.pop(sid, None)

        if session_id not in _session_trackers:
            if len(_session_trackers) >= 20:
                oldest_sid = min(_session_trackers.keys(), key=lambda k: _session_trackers[k][1])
                _session_trackers.pop(oldest_sid, None)
            _session_trackers[session_id] = (SessionTracker(session_id), now)
        else:
            tracker, _ = _session_trackers[session_id]
            _session_trackers[session_id] = (tracker, now)
        return _session_trackers[session_id][0]


def remove_session_tracker(session_id: str) -> None:
    with _session_lock:
        _session_trackers.pop(session_id, None)


# ---------------------------------------------------------------------------
# Core Inference
# ---------------------------------------------------------------------------
def _run_raw_inference(
    frame: np.ndarray,
    confidence: float = 0.35,
    iou: float = 0.45,
    imgsz: int = 640,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, float]:
    """
    Run YOLOv9 model forward pass and NMS on a single frame.
    Returns:
      (boxes_xyxy, confidences, class_ids, inference_ms)
    """
    global _model, _device

    if _model is None:
        load_model()
    if _model is None:
        return np.empty((0, 4)), np.empty((0,)), np.empty((0,), dtype=int), 0.0

    if not isinstance(frame, np.ndarray) or frame.size == 0:
        return np.empty((0, 4)), np.empty((0,)), np.empty((0,), dtype=int), 0.0

    img_h, img_w = frame.shape[:2]
    start = time.perf_counter()

    import torch
    from utils.general import non_max_suppression, scale_boxes  # type: ignore
    from utils.augmentations import letterbox  # type: ignore

    # Optimize image size on CPU for high FPS real-time webcam detection
    actual_imgsz = imgsz
    if _device == "cpu" and imgsz >= 640:
        actual_imgsz = 416

    # 1. Letterbox resize to actual_imgsz with stride 32
    img_lb = letterbox(frame, actual_imgsz, stride=32, auto=True)[0]

    # 2. Convert BGR to RGB, HWC to CHW
    img_lb = img_lb.transpose((2, 0, 1))[::-1]
    img_lb = np.ascontiguousarray(img_lb)

    # 3. Create tensor
    tensor = torch.from_numpy(img_lb).to(_device).float() / 255.0
    if len(tensor.shape) == 3:
        tensor = tensor[None]

    # 4. Model forward pass using high-performance inference_mode
    with torch.inference_mode():
        try:
            pred = _model(tensor, augment=False, visualize=False)
            if isinstance(pred, (list, tuple)):
                pred = pred[0]
        except RuntimeError as re:
            if "out of memory" in str(re).lower():
                logger.error(f"[YOLOv9] GPU OOM, falling back to CPU: {re}")
                _device = "cpu"
                _model.to("cpu")
                tensor = tensor.to("cpu")
                pred = _model(tensor, augment=False, visualize=False)
                if isinstance(pred, (list, tuple)):
                    pred = pred[0]
            else:
                raise

        # 5. Non-Maximum Suppression (optimized max_det=100 for live webcam)
        det = non_max_suppression(
            pred,
            conf_thres=confidence,
            iou_thres=iou,
            classes=None,
            max_det=100,
        )[0]

    elapsed_ms = (time.perf_counter() - start) * 1000

    if len(det) == 0:
        del tensor, pred, det
        return np.empty((0, 4)), np.empty((0,)), np.empty((0,), dtype=int), elapsed_ms

    # 6. Rescale boxes back to original frame dimensions
    det = det.clone()
    det[:, :4] = scale_boxes(tensor.shape[2:], det[:, :4], frame.shape).round()

    # Move to CPU numpy
    det_cpu = det.cpu().numpy()
    xyxy = det_cpu[:, :4]
    confs = det_cpu[:, 4]
    cids = det_cpu[:, 5].astype(int)

    del tensor, pred, det

    global _yolov9_frame_counter
    _yolov9_frame_counter += 1
    if _yolov9_frame_counter % 90 == 0:
        import gc
        gc.collect()
        if _device != "cpu":
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass

    return xyxy, confs, cids, elapsed_ms


def detect_frame(
    frame: np.ndarray,
    confidence: float = 0.35,
    iou: float = 0.45,
    imgsz: int = 640,
) -> Dict:
    """
    Run YOLOv9-C detection without tracking (for static images or simple queries).
    """
    img_h, img_w = frame.shape[:2] if isinstance(frame, np.ndarray) and frame.size > 0 else (0, 0)
    xyxy, confs, cids, elapsed_ms = _run_raw_inference(
        frame=frame,
        confidence=confidence,
        iou=iou,
        imgsz=imgsz,
    )

    detections = []
    counts: Dict[str, int] = {}

    for i in range(len(xyxy)):
        cid = int(cids[i])
        name = _model_names.get(cid, f"class_{cid}")
        conf = float(confs[i])
        x1, y1, x2, y2 = float(xyxy[i][0]), float(xyxy[i][1]), float(xyxy[i][2]), float(xyxy[i][3])

        det_obj = {
            "class_id": cid,
            "class_name": name,
            "name": name,
            "confidence": round(conf, 4),
            "x1": round(x1, 1),
            "y1": round(y1, 1),
            "x2": round(x2, 1),
            "y2": round(y2, 1),
            "bbox": {
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "x2": round(x2, 1),
                "y2": round(y2, 1),
            },
        }
        detections.append(det_obj)
        counts[name] = counts.get(name, 0) + 1

    return {
        "detections": detections,
        "counts": counts,
        "model": "yolov9-c",
        "inference_ms": round(elapsed_ms, 2),
        "frame_width": img_w,
        "frame_height": img_h,
        "timestamp": time.time(),
    }


def track_frame(
    session_id: str,
    frame: np.ndarray,
    confidence: float = 0.35,
    iou: float = 0.45,
    imgsz: int = 640,
) -> Dict:
    """
    Run YOLOv9-C detection + ByteTrack tracking for live webcam streams.
    Assigns persistent track_id per physical object and emits new_confirmed
    for debounced persistence.
    """
    img_h, img_w = frame.shape[:2] if isinstance(frame, np.ndarray) and frame.size > 0 else (0, 0)
    xyxy, confs, cids, elapsed_ms = _run_raw_inference(
        frame=frame,
        confidence=confidence,
        iou=iou,
        imgsz=imgsz,
    )

    tracker = get_or_create_tracker(session_id)
    tracked_detections, new_confirmed = tracker.update(
        xyxy=xyxy,
        confidences=confs,
        class_ids=cids,
        class_names=_model_names,
    )

    # If ByteTrack had no active tracks yet (e.g. initial frame), return raw detections
    if not tracked_detections and len(xyxy) > 0:
        raw_dets = []
        counts: Dict[str, int] = {}
        for i in range(len(xyxy)):
            cid = int(cids[i])
            name = _model_names.get(cid, f"class_{cid}")
            conf = float(confs[i])
            x1, y1, x2, y2 = float(xyxy[i][0]), float(xyxy[i][1]), float(xyxy[i][2]), float(xyxy[i][3])
            det_obj = {
                "class_id": cid,
                "class_name": name,
                "name": name,
                "confidence": round(conf, 4),
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "x2": round(x2, 1),
                "y2": round(y2, 1),
                "bbox": {"x1": round(x1, 1), "y1": round(y1, 1), "x2": round(x2, 1), "y2": round(y2, 1)},
            }
            raw_dets.append(det_obj)
            counts[name] = counts.get(name, 0) + 1

        return {
            "detections": raw_dets,
            "counts": counts,
            "active_tracks": len(raw_dets),
            "new_confirmed": [],
            "model": "yolov9-c",
            "inference_ms": round(elapsed_ms, 2),
            "frame_width": img_w,
            "frame_height": img_h,
            "timestamp": time.time(),
        }

    counts = {}
    for d in tracked_detections:
        counts[d["name"]] = counts.get(d["name"], 0) + 1

    return {
        "detections": tracked_detections,
        "counts": counts,
        "active_tracks": len(tracked_detections),
        "new_confirmed": new_confirmed,
        "model": "yolov9-c",
        "inference_ms": round(elapsed_ms, 2),
        "frame_width": img_w,
        "frame_height": img_h,
        "timestamp": time.time(),
    }


def is_loaded() -> bool:
    """Check if YOLOv9 model is loaded."""
    return _loaded and _model is not None


def unload_model() -> None:
    """Unload YOLOv9 model from memory to free RAM."""
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
            logger.info("[YOLOv9] Model unloaded to free RAM.")


def get_class_names() -> Dict[int, str]:
    """Return dictionary of 80 COCO class names."""
    return dict(_model_names)


def get_device() -> str:
    """Return current inference device."""
    return _device
