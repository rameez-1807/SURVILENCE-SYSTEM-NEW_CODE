"""
Indian ANPR Engine Adapter.
Integrates the dedicated Indian ANPR engine from references/indian-anpr.
Features:
  - Fine-tuned YOLO plate detector (references/indian-anpr/best.pt)
  - Preprocessing pipeline: deskew, CLAHE, unsharp mask, Otsu, adaptive threshold
  - Two-line plate detection for Indian motorcycles & HSRP plates
  - Position-aware Indian RTO state validation and character correction
  - Vehicle classification (Car vs Bike/Motorcycle vs Truck vs Bus)
"""

from __future__ import annotations

import base64
import logging
import sys
import time
from pathlib import Path
from typing import Optional, List, Tuple
import cv2
import numpy as np

from app.services.anpr.base import BaseANPREngine, ANPRDetectionResult

logger = logging.getLogger(__name__)

# Locate references/indian-anpr folder
_CURRENT_DIR = Path(__file__).resolve().parent
_REPO_ROOT_CANDIDATES = [
    _CURRENT_DIR.parents[4],
    _CURRENT_DIR.parents[3],
    _CURRENT_DIR.parents[2],
    Path.cwd(),
    Path.cwd() / "references" / "indian-anpr",
]

_INDIAN_ANPR_DIR: Optional[Path] = None
for candidate in _REPO_ROOT_CANDIDATES:
    target = candidate if candidate.name == "indian-anpr" else candidate / "references" / "indian-anpr"
    if target.is_dir() and (target / "plate_utils.py").exists():
        _INDIAN_ANPR_DIR = target.resolve()
        break

if _INDIAN_ANPR_DIR and str(_INDIAN_ANPR_DIR) not in sys.path:
    sys.path.insert(0, str(_INDIAN_ANPR_DIR))

# Import bundled or external indian-anpr modules
try:
    from app.services.anpr.indian_plate import plate_utils, ocr_engine  # type: ignore
except ImportError:
    try:
        import plate_utils  # type: ignore
        import ocr_engine   # type: ignore
    except ImportError:
        plate_utils = None
        ocr_engine = None



class IndianANPREngine(BaseANPREngine):
    """Indian ANPR Engine using YOLO + Multi-pass Indian OCR."""

    _detector_model = None
    _vehicle_classifier = None
    _easyocr_reader = None

    @property
    def engine_id(self) -> str:
        return "indian_anpr"

    @property
    def name(self) -> str:
        return "Indian ANPR (YOLO + Multi-Pass OCR)"

    @property
    def description(self) -> str:
        return (
            "Specialized for Indian vehicles: fine-tuned plate detector, "
            "two-line motorcycle & HSRP analysis, RTO state prefix snap, and multi-pass filtering."
        )

    @classmethod
    def _get_detector(cls):
        """Loads and caches the Indian plate detection model."""
        if cls._detector_model is None:
            from ultralytics import YOLO
            backend_dir = Path(__file__).resolve().parents[3]
            model_path = None
            for cand in [
                backend_dir / "best.pt",
                backend_dir / "models" / "best.pt",
                _INDIAN_ANPR_DIR / "best.pt" if _INDIAN_ANPR_DIR else None,
            ]:
                if cand and cand.is_file():
                    model_path = str(cand)
                    break

            if not model_path:
                model_path = str(backend_dir / "best.pt")


            logger.info(f"[IndianANPR] Loading plate detector from: {model_path}")
            cls._detector_model = YOLO(model_path)
        return cls._detector_model

    @classmethod
    def _get_vehicle_classifier(cls):
        """Loads YOLO model for vehicle classification (car, bike, truck, bus)."""
        if cls._vehicle_classifier is None:
            from ultralytics import YOLO
            backend_dir = Path(__file__).resolve().parents[3]
            model_path = backend_dir / "yolov8n.pt"
            if not model_path.exists():
                model_path = backend_dir / "best.pt"
            logger.info(f"[IndianANPR] Loading vehicle classifier from: {model_path}")
            cls._vehicle_classifier = YOLO(str(model_path))
        return cls._vehicle_classifier

    @classmethod
    def _get_reader(cls):
        """Loads and caches EasyOCR reader."""
        if cls._easyocr_reader is None:
            import easyocr
            logger.info("[IndianANPR] Initializing EasyOCR reader (CPU mode)...")
            cls._easyocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        return cls._easyocr_reader

    def detect_and_read(
        self,
        img_bgr: np.ndarray,
        is_live_stream: bool = False
    ) -> ANPRDetectionResult:
        """Runs the complete Indian ANPR pipeline on the provided BGR image frame."""
        t0 = time.perf_counter()
        h, w = img_bgr.shape[:2]

        detector = self._get_detector()
        reader = self._get_reader()
        ocr_res = None

        # 1. Vehicle Classification (Car vs Bike/Motorcycle vs Truck vs Bus)
        vehicle_type = "car"
        try:
            v_classifier = self._get_vehicle_classifier()
            # Fast downscaled inference for vehicle type
            v_scale = min(1.0, 480 / max(w, h))
            v_img = cv2.resize(img_bgr, (int(w * v_scale), int(h * v_scale))) if v_scale < 1.0 else img_bgr
            v_res_list = list(v_classifier(v_img, conf=0.25, verbose=False))
            if v_res_list:
                v_res = v_res_list[0]
                boxes = getattr(v_res, "boxes", None)
                names = getattr(v_res, "names", {}) or {}
                if boxes is not None:
                    for box in boxes:
                        cid = int(box.cls[0])
                        cname = names.get(cid, "").lower() if isinstance(names, dict) else ""
                        if any(k in cname for k in ["bike", "motorcycle", "scoty", "scooter", "electric-scoty"]):
                            vehicle_type = "motorcycle"
                            break
                        elif any(k in cname for k in ["truck", "lorry", "jcb", "trailer", "pickup"]):
                            vehicle_type = "truck"
                            break
                        elif "bus" in cname:
                            vehicle_type = "bus"
                            break
                        elif any(k in cname for k in ["car", "auto", "taxi", "jeep"]):
                            vehicle_type = "car"
        except Exception as e:
            logger.debug(f"[IndianANPR] Vehicle classification warning: {e}")

        # 2. Plate Detection via YOLO
        plate_boxes: List[Tuple[float, List[int]]] = []
        try:
            # Resize appropriately for YOLO inference if large
            scale_yolo = min(1.0, 960 / max(w, h))
            det_img = cv2.resize(img_bgr, (int(w * scale_yolo), int(h * scale_yolo))) if scale_yolo < 1.0 else img_bgr
            p_res_list = list(detector(det_img, conf=0.20, verbose=False))
            if p_res_list:
                p_res = p_res_list[0]
                p_boxes = getattr(p_res, "boxes", None)
                if p_boxes is not None:
                    for box in p_boxes:
                        conf = float(box.conf[0])
                        bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                        # Map coordinates back to original frame
                        x1 = max(0, int(bx1 / scale_yolo))
                        y1 = max(0, int(by1 / scale_yolo))
                        x2 = min(w, int(bx2 / scale_yolo))
                        y2 = min(h, int(by2 / scale_yolo))

                        pw, ph = x2 - x1, y2 - y1
                        # Support both car wide plates and bike squarish plates
                        if pw >= 20 and ph >= 10:
                            aspect = pw / max(1, ph)
                            if 0.7 <= aspect <= 7.0:
                                plate_boxes.append((conf, [x1, y1, x2, y2]))
        except Exception as e:
            logger.warning(f"[IndianANPR] Plate detector error: {e}")

        best_plate = ""
        best_raw = ""
        best_conf = 0.0
        best_box: Optional[List[int]] = None
        best_crop_b64: Optional[str] = None
        is_valid_format = False

        # Sort plate candidates by detection confidence descending
        plate_boxes.sort(key=lambda x: x[0], reverse=True)

        # 3. OCR on Candidate Plates
        if plate_boxes:
            for p_conf, (x1, y1, x2, y2) in plate_boxes[:3]:
                pw, ph = x2 - x1, y2 - y1
                # Add padding
                pad_x = int(pw * 0.08)
                pad_y = int(ph * 0.12)
                cx1 = max(0, x1 - pad_x)
                cy1 = max(0, y1 - pad_y)
                cx2 = min(w, x2 + pad_x)
                cy2 = min(h, y2 + pad_y)

                crop = img_bgr[cy1:cy2, cx1:cx2]
                if crop.size == 0:
                    continue

                ocr_res = None
                if ocr_engine is not None:
                    try:
                        ocr_res = ocr_engine.read_plate(crop, reader, use_tesseract=False)
                    except Exception as err:
                        logger.debug(f"[IndianANPR] read_plate exception: {err}")

                txt = ocr_res.get("text", "") if ocr_res else ""
                raw_txt = ocr_res.get("raw", "") if ocr_res else ""
                c_conf = float(ocr_res.get("confidence", 0.0)) if ocr_res else 0.0

                # Validate Indian plate format
                valid = False
                cleaned_plate = txt
                if plate_utils is not None and txt:
                    valid = plate_utils.is_valid_indian_plate(txt)
                    cleaned_plate = plate_utils.clean_plate(txt)

                # Prioritize valid formats or highest confidence
                combined_conf = round(float(p_conf * 0.35 + c_conf * 0.65), 2)
                if (valid and not is_valid_format) or (valid == is_valid_format and combined_conf > best_conf):
                    best_plate = cleaned_plate
                    best_raw = raw_txt or txt
                    best_conf = combined_conf
                    best_box = [x1, y1, x2, y2]
                    is_valid_format = valid

                    _, buf = cv2.imencode(".jpg", crop)
                    best_crop_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

                    if valid:
                        break

        # 4. Fallback if no box detected (e.g. image is already a crop)
        if not best_plate and (w <= 350 or h <= 150):
            try:
                ocr_res = ocr_engine.read_plate(img_bgr, reader, use_tesseract=False) if ocr_engine else {}
                txt = ocr_res.get("text", "")
                if txt:
                    best_raw = ocr_res.get("raw", txt)
                    valid = plate_utils.is_valid_indian_plate(txt) if plate_utils else False
                    best_plate = plate_utils.clean_plate(txt) if plate_utils else txt
                    best_conf = round(float(ocr_res.get("confidence", 0.8)), 2)
                    best_box = [0, 0, w, h]
                    is_valid_format = valid
                    _, buf = cv2.imencode(".jpg", img_bgr)
                    best_crop_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"
            except Exception as e:
                logger.debug(f"[IndianANPR] Crop fallback error: {e}")

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        return ANPRDetectionResult(
            plate=best_plate,
            raw_plate=best_raw,
            confidence=best_conf,
            vehicle_type=vehicle_type,
            bounding_box=best_box,
            cropped_plate_base64=best_crop_b64,
            is_valid_format=is_valid_format,
            engine=self.engine_id,
            processing_time_ms=elapsed_ms,
            metadata={"two_line": ocr_res.get("two_line", False) if isinstance(ocr_res, dict) else False}
        )
