"""
FastALPR Engine Adapter.
Integrates FastALPR framework:
  - ONNX Runtime execution for high FPS & low latency
  - YOLOv9 end-to-end plate detector
  - CCT (Compact Convolutional Transformer) plate character recognition
  - Indian plate post-processing & state code resolution
  - Vehicle classification (Car vs Motorcycle vs Truck vs Bus)
"""

from __future__ import annotations

import base64
import logging
import re
import time
from pathlib import Path
from typing import Optional, List, Tuple
import cv2
import numpy as np

from app.services.anpr.base import BaseANPREngine, ANPRDetectionResult

logger = logging.getLogger(__name__)


class FastALPREngine(BaseANPREngine):
    """FastALPR high-performance ONNX engine adapter."""

    _alpr_instance = None
    _vehicle_classifier = None

    @property
    def engine_id(self) -> str:
        return "fast_alpr"

    @property
    def name(self) -> str:
        return "FastALPR (ONNX Runtime)"

    @property
    def description(self) -> str:
        return (
            "Ultra high-speed ONNX runtime ALPR with YOLOv9 detector and "
            "Compact Convolutional Transformer OCR, optimized for real-time video streams."
        )

    @classmethod
    def _get_alpr(cls):
        """Loads and caches the FastALPR singleton instance."""
        if cls._alpr_instance is None:
            try:
                from fast_alpr import ALPR
                logger.info("[FastALPR] Initializing ALPR engine (ONNX Runtime)...")
                cls._alpr_instance = ALPR(
                    detector_model="yolo-v9-t-384-license-plate-end2end",
                    ocr_model="cct-xs-v2-global-model"
                )
                logger.info("[FastALPR] FastALPR engine initialized successfully.")
            except Exception as e:
                logger.error(f"[FastALPR] Failed to initialize ALPR: {e}", exc_info=True)
                raise
        return cls._alpr_instance

    @classmethod
    def _get_vehicle_classifier(cls):
        """Loads YOLO model for vehicle classification."""
        if cls._vehicle_classifier is None:
            from ultralytics import YOLO
            backend_dir = Path(__file__).resolve().parents[3]
            model_path = backend_dir / "yolov8n.pt"
            if not model_path.exists():
                model_path = backend_dir / "best.pt"
            cls._vehicle_classifier = YOLO(str(model_path))
        return cls._vehicle_classifier

    @staticmethod
    def _clean_indian_plate(raw: str) -> Tuple[str, bool]:
        """
        Cleans and formats OCR text according to Indian license plate standards:
        Standard: [State:2][RTO:2][Series:1-3][Number:4] e.g. MH12DE1433, DL7CQ1939, MH43CC1745.
        """
        if not raw:
            return "", False

        cleaned = re.sub(r'[^A-Z0-9]', '', raw.upper().strip())
        if len(cleaned) < 5:
            return cleaned, False

        # Known Indian state codes
        state_codes = {
            'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ',
            'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP',
            'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TR', 'TS', 'UK', 'UA',
            'UP', 'WB', 'BH'
        }

        # Check BH series: YY BH #### XX
        if len(cleaned) in (9, 10) and cleaned[2:4] == "BH" and cleaned[:2].isdigit():
            return cleaned, True

        # Standard Indian plates: First 2 chars must be valid state code
        prefix = cleaned[:2]
        # Optical correction for common first 2 digits
        digit_to_char = {'0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B'}
        fixed_prefix = "".join(digit_to_char.get(c, c) for c in prefix)

        # Snap to closest known state code if 1 char off
        if fixed_prefix not in state_codes:
            for sc in state_codes:
                if (sc[0] == fixed_prefix[0] and fixed_prefix[1] in ('0', '1', 'D', 'L', 'H', 'M')) or \
                   (sc[1] == fixed_prefix[1] and fixed_prefix[0] in ('0', 'M', 'D', 'K', 'T')):
                    fixed_prefix = sc
                    break

        if fixed_prefix in state_codes:
            tail = cleaned[2:]
            # Ensure RTO (chars 2-3) are digits
            if len(tail) >= 2:
                char_to_digit = {'O': '0', 'D': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8'}
                rto = "".join(char_to_digit.get(c, c) for c in tail[:2])
                tail = rto + tail[2:]
            
            # Format plate text
            full_plate = fixed_prefix + tail
            is_valid = len(full_plate) in (8, 9, 10) and full_plate[-4:].isdigit()
            return full_plate, is_valid

        return cleaned, len(cleaned) in (8, 9, 10)

    def detect_and_read(
        self,
        img_bgr: np.ndarray,
        is_live_stream: bool = False
    ) -> ANPRDetectionResult:
        """Runs FastALPR detection & OCR on BGR image frame."""
        t0 = time.perf_counter()
        h, w = img_bgr.shape[:2]

        alpr = self._get_alpr()

        # 1. Vehicle Classification (Car vs Bike/Motorcycle vs Truck vs Bus)
        vehicle_type = "car"
        try:
            v_classifier = self._get_vehicle_classifier()
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
            logger.debug(f"[FastALPR] Vehicle classification warning: {e}")

        # 2. FastALPR Prediction (Expects RGB or BGR - ALPR handles both)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        best_plate = ""
        best_raw = ""
        best_conf = 0.0
        best_box: Optional[List[int]] = None
        best_crop_b64: Optional[str] = None
        is_valid_format = False

        try:
            predictions = alpr.predict(img_rgb)
        except Exception as err:
            logger.warning(f"[FastALPR] predict error: {err}")
            predictions = []

        if predictions:
            # Sort by detection confidence
            predictions.sort(key=lambda p: float(p.detection.confidence), reverse=True)
            top = predictions[0]

            bbox = top.detection.bounding_box
            bx1, by1, bx2, by2 = max(0, bbox.x1), max(0, bbox.y1), min(w, bbox.x2), min(h, bbox.y2)
            best_box = [bx1, by1, bx2, by2]

            raw_txt = top.ocr.text if top.ocr else ""
            best_raw = raw_txt

            # Compute OCR confidence
            c_vals = top.ocr.confidence if top.ocr else 0.0
            if isinstance(c_vals, list):
                c_conf = float(np.mean(c_vals)) if c_vals else 0.0
            else:
                c_conf = float(c_vals) if c_vals else 0.0

            det_conf = float(top.detection.confidence)
            best_conf = round(float(det_conf * 0.35 + c_conf * 0.65), 2)

            cleaned, is_v = self._clean_indian_plate(raw_txt)
            best_plate = cleaned
            is_valid_format = is_v

            # Generate cropped plate preview
            crop = img_bgr[by1:by2, bx1:bx2]
            if crop.size > 0:
                _, buf = cv2.imencode(".jpg", crop)
                best_crop_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

        # 3. Direct OCR Fallback if no detector box was found (e.g. image is already a crop)
        if not best_plate and (w <= 350 or h <= 150):
            try:
                ocr_out = alpr.ocr.predict(img_rgb)
                if ocr_out and ocr_out.text:
                    raw_txt = ocr_out.text
                    best_raw = raw_txt
                    c_vals = ocr_out.confidence
                    if isinstance(c_vals, list) and c_vals:
                        c_conf = float(np.mean(c_vals))
                    elif isinstance(c_vals, (int, float)):
                        c_conf = float(c_vals)
                    else:
                        c_conf = 0.8
                    cleaned, is_v = self._clean_indian_plate(raw_txt)
                    best_plate = cleaned
                    is_valid_format = is_v
                    best_conf = round(c_conf, 2)
                    best_box = [0, 0, w, h]
                    _, buf = cv2.imencode(".jpg", img_bgr)
                    best_crop_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"
            except Exception as e:
                logger.debug(f"[FastALPR] Crop OCR fallback warning: {e}")

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
            processing_time_ms=elapsed_ms
        )
