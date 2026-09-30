import base64
import io
import os
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Dict, Any

import math
import cv2
import numpy as np
from PIL import Image
from sqlalchemy import select, func, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import VehicleRecord
from app.schemas.vehicle import VehicleCreate, VehicleStats

logger = logging.getLogger(__name__)

# Indian State & Union Territory RTO 2-letter codes
INDIAN_STATES = {
    'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ',
    'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP',
    'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TR', 'TS', 'UK', 'UA',
    'UP', 'WB'
}

# Maximum RTO district codes per state (prevents fake detections like CH44, GA99, DL44, ML79)
STATE_MAX_RTO = {
    'AN': 2, 'AP': 39, 'AR': 22, 'AS': 34, 'BR': 72, 'CG': 30, 'CH': 4,
    'DD': 3, 'DL': 14, 'DN': 2, 'GA': 12, 'GJ': 38, 'HP': 97, 'HR': 99,
    'JH': 24, 'JK': 22, 'KA': 71, 'KL': 86, 'LA': 2, 'LD': 9, 'MH': 50,
    'ML': 14, 'MN': 7, 'MP': 70, 'MZ': 9, 'NL': 8, 'OD': 35, 'OR': 35,
    'PB': 91, 'PY': 5, 'RJ': 58, 'SK': 8, 'TR': 8, 'TS': 38, 'UK': 20,
    'UA': 20, 'UP': 96, 'WB': 99
}

# Strict OCR Optical Confusions (Only genuine visual character twins on Indian HSRP plates):
# When a DIGIT is expected (0-9) but OCR saw a similar letter:
CHAR_TO_DIGIT = {
    'O': '0', 'D': '0', 'Q': '0', 'U': '0',
    'I': '1', 'l': '1', '|': '1', 'T': '1', 'J': '1',
    'Z': '2',
    'A': '4', 'L': '4',
    'S': '5',
    'G': '6', 'b': '6',
    'B': '8',
}

# When a LETTER is expected (A-Z) but OCR saw a similar digit:
DIGIT_TO_CHAR = {
    '0': 'O',
    '1': 'I',
    '2': 'Z',
    '4': 'A',
    '5': 'S',
    '6': 'G',
    '8': 'B',
}

# Optical corrections for State code (first 2 letters):
STATE_CHAR0_CANDIDATES = {
    '0': ['D', 'O'],
    '8': ['B'],
    '1': ['I'],
    '5': ['S'],
    '2': ['Z']
}

STATE_CHAR1_CANDIDATES = {
    '0': ['D', 'O'],
    '1': ['L', 'I'],
    '8': ['B'],
    '5': ['S'],
    '2': ['Z'],
    '4': ['A'],
    '7': ['T']
}

# Known visual confusion pairs for 2-letter state codes (e.g. M vs H, 0 vs D):
STATE_CORRECTIONS = {
    'HH': 'MH',  # Maharashtra: M frequently read as H
    'MM': 'MH',
    'JM': 'JH',  # Jharkhand: H read as M
    'CM': 'CH',  # Chandigarh: H read as M
    'HL': 'ML',  # Meghalaya: M read as H
    'HN': 'MN',  # Manipur: M read as H
    'HZ': 'MZ',  # Mizoram: M read as H
    '0L': 'DL',  # Delhi: D read as 0
    'D1': 'DL',  # Delhi: L read as 1
    '8R': 'BR',  # Bihar: B read as 8
    '5K': 'SK',  # Sikkim: S read as 5
    '2P': 'UP',  # Uttar Pradesh: U read as 2
    '0D': 'OD',  # Odisha: O read as 0
}

# Class ID mapping for best.pt (trained on 25 Indian traffic classes)
# Class 14 is the License Plate ('Number'). Classes 0-13 & 15-24 are vehicle types.
PLATE_CLASS_ID = 14
VEHICLE_CLASS_MAP = {
    0: 'car',          # Ambulance
    1: 'car',          # Auto
    2: 'motorcycle',   # Bike
    3: 'truck',        # Bulldozer
    4: 'bus',          # Bus
    5: 'car',          # Car
    6: 'truck',        # Concrete-Mixer-Truck
    7: 'car',          # E-Rickshow
    8: 'motorcycle',   # Electric-Scoty
    9: 'truck',        # Fire-Truck
    10: 'truck',       # Garbage-Truck
    11: 'truck',       # JCB
    12: 'car',         # Jeep
    13: 'truck',       # Lorry
    15: 'truck',       # Pickup
    16: 'car',         # Police Vehicle
    17: 'truck',       # Roller
    18: 'motorcycle',  # Scoty
    19: 'truck',       # Tank-Truck
    20: 'car',         # Taxi
    21: 'truck',       # Tow-Truck
    22: 'truck',       # Tractor
    23: 'truck',       # Trailer
    24: 'truck',       # Truck
}



class VehicleService:
    """
    Production ANPR & Vehicle Detection Service:
    - YOLOv8 Object & Plate Detection (best.pt)
    - EasyOCR with Multi-Variant Adaptive Contrast & Threshold Enhancement
    - Strict Positional Smart OCR Verification (Indian Number Plate Standards)
    - Full SQLite Storage & Location Tagging
    """

    _plate_model = None
    _vehicle_model = None
    _easyocr_reader = None

    # COCO Class IDs for vehicles: 1: bicycle, 2: car, 3: motorcycle, 5: bus, 7: truck
    VEHICLE_CLASSES = [1, 2, 3, 5, 7]

    # Enterprise Multi-Frame Temporal Consensus Buffer
    # Maps camera/location spot to recent frame readings:
    _temporal_buffers: Dict[str, List[Dict[str, Any]]] = {}
    TEMPORAL_WINDOW_SECONDS: float = 2.5

    # Enterprise Access Control Watchlists (Resident, VIP, Blacklist, Visitor)
    SECURITY_WATCHLIST: Dict[str, str] = {}

    @classmethod
    def _find_model_file(cls, filename: str) -> str:
        """Locates model weights file across candidate locations."""
        current_file = Path(__file__).resolve()
        candidates = [
            current_file.parents[2] / filename,      # .../backend/filename
            current_file.parents[1] / filename,      # .../app/filename
            current_file.parents[3] / filename,      # .../root/filename
            Path.cwd() / filename,                   # ./filename
            Path.cwd() / "backend" / filename,       # ./backend/filename
        ]
        for cand in candidates:
            if cand.exists():
                return str(cand)
        return filename

    @classmethod
    def _get_plate_model(cls):
        """Loads and caches the trained YOLO best.pt plate detection model."""
        if cls._plate_model is None:
            try:
                from ultralytics import YOLO
                model_path = cls._find_model_file("best.pt")
                logger.info(f"[ANPR] Loading Plate YOLO model from '{model_path}'...")
                cls._plate_model = YOLO(model_path)
                logger.info("[ANPR] Plate YOLO model loaded successfully.")
            except Exception as e:
                logger.warning(f"[ANPR] Could not load Plate YOLO model: {e}")
                cls._plate_model = None
        return cls._plate_model

    @classmethod
    def _get_vehicle_model(cls):
        """Loads and caches YOLOv8 model for vehicle type classification (car, motorcycle, bus, truck)."""
        if cls._vehicle_model is None:
            try:
                from ultralytics import YOLO
                model_path = cls._find_model_file("yolov8n.pt")
                logger.info(f"[ANPR] Loading Vehicle Classifier YOLO model from '{model_path}'...")
                cls._vehicle_model = YOLO(model_path)
                logger.info("[ANPR] Vehicle Classifier YOLO model loaded successfully.")
            except Exception as e:
                logger.warning(f"[ANPR] Could not load Vehicle Classifier model: {e}")
                cls._vehicle_model = None
        return cls._vehicle_model

    @classmethod
    def _get_easyocr_reader(cls):
        """Loads and caches the EasyOCR English reader."""
        if cls._easyocr_reader is None:
            try:
                import easyocr
                logger.info("[ANPR] Initializing EasyOCR reader (CPU mode)...")
                cls._easyocr_reader = easyocr.Reader(["en"], gpu=False)
                logger.info("[ANPR] EasyOCR reader initialized successfully.")
            except Exception as e:
                logger.warning(f"[ANPR] Could not load EasyOCR: {e}")
                cls._easyocr_reader = None
        return cls._easyocr_reader

    @staticmethod
    def _is_valid_rto(state: str, rto_str: str) -> bool:
        """Validates that RTO district number is within legal bounds for the state."""
        if not rto_str.isdigit():
            return False
        rto_num = int(rto_str)
        if rto_num == 0:
            return False
        max_rto = STATE_MAX_RTO.get(state, 99)
        return rto_num <= max_rto

    @classmethod
    def check_security_status(cls, plate: str) -> Dict[str, Any]:
        """
        Enterprise Access Control Engine:
        Classifies plate as RESIDENT, VIP, VISITOR, or BLACKLISTED,
        and determines automated boom barrier action (OPEN, HOLD, LOG).
        """
        clean = re.sub(r'[^A-Za-z0-9]', '', plate).upper()
        category = cls.SECURITY_WATCHLIST.get(clean, "VISITOR")
        is_blacklisted = (category == "BLACKLIST")
        barrier_action = "HOLD" if is_blacklisted else "OPEN" if category in ("RESIDENT", "VIP") else "LOG"
        return {
            "category": category,
            "is_blacklisted": is_blacklisted,
            "barrier_action": barrier_action,
            "badge_color": "red" if is_blacklisted else "green" if category in ("RESIDENT", "VIP") else "blue"
        }

    @classmethod
    def _compute_consensus_plate(cls, candidates: List[str]) -> Tuple[str, float]:
        """
        Enterprise Multi-Frame Temporal Voting Algorithm:
        Computes positional character-by-character majority voting across multiple
        consecutive frames of a passing vehicle to eliminate transient optical misreads
        (such as T vs I, A vs 4, I vs L, M vs H).
        """
        if not candidates:
            return "", 0.0
        from collections import Counter
        lengths = [len(c) for c in candidates if len(c) in (8, 9, 10)]
        if not lengths:
            return candidates[-1], 0.85
        target_len = Counter(lengths).most_common(1)[0][0]
        valid_cands = [c for c in candidates if len(c) == target_len]
        if not valid_cands:
            return candidates[-1], 0.85

        consensus_chars = []
        agreement_scores = []
        for col in range(target_len):
            col_chars = [c[col] for c in valid_cands]
            top_char, count = Counter(col_chars).most_common(1)[0]
            consensus_chars.append(top_char)
            agreement_scores.append(count / len(valid_cands))

        consensus_plate = "".join(consensus_chars)
        avg_agreement = float(np.mean(agreement_scores)) if agreement_scores else 0.90
        return consensus_plate, round(avg_agreement, 2)

    @classmethod
    def _resolve_state(cls, c0: str, c1: str) -> str:
        """Resolves optical confusions in Indian state 2-letter codes (e.g., 0L -> DL, 8R -> BR, D1 -> DL, HH -> MH, JM -> JH)."""
        c0 = c0.upper()
        c1 = c1.upper()
        direct = c0 + c1
        if direct in INDIAN_STATES:
            return direct
        if direct in STATE_CORRECTIONS:
            return STATE_CORRECTIONS[direct]
        c0_list = STATE_CHAR0_CANDIDATES.get(c0, [c0]) if c0.isdigit() else [c0]
        c1_list = STATE_CHAR1_CANDIDATES.get(c1, [c1]) if c1.isdigit() else [c1]
        for s0 in c0_list:
            for s1 in c1_list:
                st = s0 + s1
                if st in INDIAN_STATES:
                    return st
        return ""

    @classmethod
    def format_number_plate(cls, raw_text: str) -> Tuple[str, bool]:
        """
        Validates raw OCR text and formats it strictly into verified Indian Number Plate standards:
        - 10-char Standard: [State:2][RTO:2][Series:2][Unique:4] (e.g. MH12DE1433, DL01AB1234, JH03MF4477)
        - Delhi 10-char: [DL][RTO:1 digit][Series:3 letters][Unique:4] (e.g. DL8CAA1234)
        - 9-char Standard: [State:2][RTO:2][Series:1][Unique:4] (e.g. DL01A1234, GJ05B1234, MH12A1234)
        - Delhi 8/9-char: [DL][1 digit][1-2 letters][Unique:4] (e.g. DL4CA1234, DL1C1234)
        - Bharat Series: [2 digits]BH[4 digits][1-2 letters] (e.g. 22BH1234AA)
        - Standard 8-char: [State:2][RTO:1-2][Series:1][Unique:4] (e.g. MH01A1234, DL1A1234)

        Returns: (formatted_plate, is_valid_format)
        """
        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper().strip()
        if not cleaned or len(cleaned) < 8:
            return "", False

        # Strip common OCR noise prefixes (IND, 1ND, LND, INDIA, HSRP, GOVT, POLICE) ONLY if remainder is plate length
        for prefix in ["INDIA", "1NDIA", "IND", "1ND", "LND", "IN0", "HSRP", "GOVT", "POLICE"]:
            if cleaned.startswith(prefix) and (len(cleaned) - len(prefix)) in (8, 9, 10):
                cleaned = cleaned[len(prefix):]
                break

        # A valid Indian plate MUST be exactly 8, 9, or 10 characters long
        if len(cleaned) not in (8, 9, 10):
            return "", False

        # --- 1. Direct Regex Matching (for clean OCR text) ---
        # Standard 10-char: State(2) + RTO(2) + Series(2) + Unique(4)
        if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$", cleaned):
            state = cleaned[:2]
            if state in INDIAN_STATES and cls._is_valid_rto(state, cleaned[2:4]):
                return cleaned, True

        # Delhi 10-char: DL + 1 digit + 3 letters + 4 digits
        if re.match(r"^DL[0-9]{1}[A-Z]{3}[0-9]{4}$", cleaned):
            if int(cleaned[2]) in range(1, 15):
                return cleaned, True

        # Standard 9-char: State(2) + RTO(2) + Series(1) + Unique(4)
        if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{4}$", cleaned):
            state = cleaned[:2]
            if state in INDIAN_STATES and cls._is_valid_rto(state, cleaned[2:4]):
                return cleaned, True

        # Delhi 8/9-char: DL + 1 digit + 1-2 letters + 4 digits
        if re.match(r"^DL[0-9]{1}[A-Z]{1,2}[0-9]{4}$", cleaned):
            if int(cleaned[2]) in range(1, 15):
                return cleaned, True

        # Bharat Series: 2 digits (Year) + BH + 4 digits + 1-2 letters
        if re.match(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$", cleaned):
            return cleaned, True

        # Standard 8-char: State(2) + 1 digit RTO + 1 letter Series + 4 digits Unique
        if re.match(r"^[A-Z]{2}[0-9]{1}[A-Z]{1}[0-9]{4}$", cleaned):
            state = cleaned[:2]
            if state in INDIAN_STATES and cls._is_valid_rto(state, cleaned[2:3]):
                return cleaned, True

        # --- 2. Positional Optical Confusion Correction (ONLY for legitimate OCR twins) ---
        # 10-character correction
        if len(cleaned) == 10:
            if cleaned[2:4] == "BH":
                yr = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[0:2])
                u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[4:8])
                s = "".join(DIGIT_TO_CHAR.get(c, c) for c in cleaned[8:10])
                cand = yr + "BH" + u + s
                if re.match(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$", cand):
                    return cand, True

            state = cls._resolve_state(cleaned[0], cleaned[1])
            if state:
                # Delhi 10-char: DL + 1 digit + 3 letters + 4 digits
                if state == "DL":
                    rto = CHAR_TO_DIGIT.get(cleaned[2], cleaned[2])
                    s = "".join(DIGIT_TO_CHAR.get(c, c) for c in cleaned[3:6])
                    u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[6:10])
                    cand = "DL" + rto + s + u
                    if re.match(r"^DL[0-9]{1}[A-Z]{3}[0-9]{4}$", cand) and int(rto) in range(1, 15):
                        return cand, True

                # Standard 10-char: State(2) + RTO(2) + Series(2) + Unique(4)
                rto = CHAR_TO_DIGIT.get(cleaned[2], cleaned[2]) + CHAR_TO_DIGIT.get(cleaned[3], cleaned[3])
                s = DIGIT_TO_CHAR.get(cleaned[4], cleaned[4]) + DIGIT_TO_CHAR.get(cleaned[5], cleaned[5])
                u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[6:10])
                cand = state + rto + s + u
                if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$", cand) and cls._is_valid_rto(state, rto):
                    return cand, True

        # 9-character correction
        if len(cleaned) == 9:
            if cleaned[2:4] == "BH":
                yr = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[0:2])
                u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[4:8])
                s = DIGIT_TO_CHAR.get(cleaned[8], cleaned[8])
                cand = yr + "BH" + u + s
                if re.match(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1}$", cand):
                    return cand, True

            state = cls._resolve_state(cleaned[0], cleaned[1])
            if state:
                # Delhi 9-char
                if state == "DL":
                    rto = CHAR_TO_DIGIT.get(cleaned[2], cleaned[2])
                    s = "".join(DIGIT_TO_CHAR.get(c, c) for c in cleaned[3:5])
                    u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[5:9])
                    cand = "DL" + rto + s + u
                    if re.match(r"^DL[0-9]{1}[A-Z]{2}[0-9]{4}$", cand) and int(rto) in range(1, 15):
                        return cand, True

                # Standard 9-char: State(2) + RTO(2) + Series(1) + Unique(4)
                rto = CHAR_TO_DIGIT.get(cleaned[2], cleaned[2]) + CHAR_TO_DIGIT.get(cleaned[3], cleaned[3])
                s = DIGIT_TO_CHAR.get(cleaned[4], cleaned[4])
                u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[5:9])
                cand = state + rto + s + u
                if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{4}$", cand) and cls._is_valid_rto(state, rto):
                    return cand, True

        # 8-character correction
        if len(cleaned) == 8:
            state = cls._resolve_state(cleaned[0], cleaned[1])
            if state:
                # Delhi 8-char: DL + 1 digit + 1 letter + 4 digits
                if state == "DL":
                    rto = CHAR_TO_DIGIT.get(cleaned[2], cleaned[2])
                    s = DIGIT_TO_CHAR.get(cleaned[3], cleaned[3])
                    u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[4:8])
                    cand = "DL" + rto + s + u
                    if re.match(r"^DL[0-9]{1}[A-Z]{1}[0-9]{4}$", cand) and int(rto) in range(1, 15):
                        return cand, True

                # Standard 8-char: State(2) + RTO(1) + Series(1) + Unique(4)
                rto = CHAR_TO_DIGIT.get(cleaned[2], cleaned[2])
                s = DIGIT_TO_CHAR.get(cleaned[3], cleaned[3])
                u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[4:8])
                cand = state + rto + s + u
                if re.match(r"^[A-Z]{2}[0-9]{1}[A-Z]{1}[0-9]{4}$", cand) and cls._is_valid_rto(state, rto):
                    return cand, True

        return "", False

    @classmethod
    def get_plate_image_variants(cls, plate_bgr: np.ndarray) -> List[np.ndarray]:
        """
        Generates fast, high-accuracy representations for plate OCR:
        1. Clean-scaled BGR (target height 70px) with border padding (fastest, high-precision CRAFT text detection)
        2. Contrast-enhanced CLAHE BGR (fallback for low-contrast/dark plates)
        """
        variants = []
        try:
            ph, pw = plate_bgr.shape[:2]
            target_h = 70
            scale = target_h / max(ph, 1)
            scaled = cv2.resize(plate_bgr, (max(int(pw * scale), 40), target_h), interpolation=cv2.INTER_CUBIC)
            pad = cv2.copyMakeBorder(scaled, 6, 6, 8, 8, cv2.BORDER_REPLICATE)
            variants.append(pad)

            # Fallback CLAHE enhanced variant
            gray = cv2.cvtColor(pad, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
            enhanced = cv2.cvtColor(clahe.apply(gray), cv2.COLOR_GRAY2BGR)
            variants.append(enhanced)
        except Exception as e:
            logger.warning(f"[ANPR] Image variant generation error: {e}")
            variants = [plate_bgr]
        return variants

    @classmethod
    def _detect_and_read_plate(cls, img_bgr: np.ndarray, is_live_stream: bool = False) -> Dict[str, Any]:
        """
        High-precision ANPR inference:
        1. Scales frame for rapid YOLO plate detection.
        2. Detects Class 14 ('Number') for plates, and vehicle classes for vehicle type.
        3. Validates plate bounding box aspect ratio (1.2 to 6.0) and minimum size.
        4. Crops plate with margin and runs enhanced EasyOCR with confidence filtering.
        5. In live stream mode, avoids full-image OCR on empty frames to eliminate background false positives.
        """
        plate_model = cls._get_plate_model()
        vehicle_model = cls._get_vehicle_model()
        reader = cls._get_easyocr_reader()

        h, w = img_bgr.shape[:2]
        best_plate = ""
        best_conf = 0.0
        best_box = None
        best_valid = False
        cropped_b64 = None
        raw_ocr_found = ""
        detected_vehicle_type = "car"

        # Step 1: Scale frame for high-speed YOLO inference (max dim 384 for ultra-fast CPU inference)
        scale_yolo = min(1.0, 384.0 / max(h, w))
        if scale_yolo < 1.0:
            img_yolo = cv2.resize(img_bgr, None, fx=scale_yolo, fy=scale_yolo, interpolation=cv2.INTER_LINEAR)
        else:
            img_yolo = img_bgr

        # Step 2: High-Speed Plate & Vehicle YOLO Detection (using best.pt)
        plate_candidates = []
        vehicle_candidates = []

        if plate_model is not None:
            try:
                p_results = plate_model(img_yolo, imgsz=384, verbose=False, conf=0.20)
                for res in p_results:
                    for box in res.boxes:
                        cid = int(box.cls[0])
                        conf = float(box.conf[0])
                        if cid == PLATE_CLASS_ID:
                            plate_candidates.append((conf, box))
                        elif cid in VEHICLE_CLASS_MAP:
                            vehicle_candidates.append((conf, VEHICLE_CLASS_MAP[cid]))

                # Determine vehicle type from detected vehicle class if present
                if vehicle_candidates:
                    vehicle_candidates.sort(key=lambda x: x[0], reverse=True)
                    detected_vehicle_type = vehicle_candidates[0][1]

                # Process license plate candidates
                plate_candidates.sort(key=lambda x: x[0], reverse=True)
                for p_conf, box in plate_candidates:
                    bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                    # Map back to original high-res image
                    x1 = max(0, int(bx1 / scale_yolo))
                    y1 = max(0, int(by1 / scale_yolo))
                    x2 = min(w, int(bx2 / scale_yolo))
                    y2 = min(h, int(by2 / scale_yolo))

                    pw = x2 - x1
                    ph = y2 - y1

                    # Geometric sanity check: standard plates are wide rectangles
                    if pw < 30 or ph < 10:
                        continue
                    aspect_ratio = pw / max(ph, 1)
                    if aspect_ratio < 1.2 or aspect_ratio > 6.0:
                        continue

                    pad_x = int(pw * 0.10)
                    pad_y = int(ph * 0.15)
                    cx1 = max(0, x1 - pad_x)
                    cy1 = max(0, y1 - pad_y)
                    cx2 = min(w, x2 + pad_x)
                    cy2 = min(h, y2 + pad_y)
                    plate_crop = img_bgr[cy1:cy2, cx1:cx2]
                    if plate_crop.size == 0:
                        continue

                    if reader is not None:
                        variants = cls.get_plate_image_variants(plate_crop)
                        for var_img in variants:
                            try:
                                ocr_entries = reader.readtext(
                                    var_img,
                                    detail=1,
                                    allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
                                    beamWidth=1,
                                    paragraph=False,
                                    canvas_size=256,
                                    mag_ratio=1.0
                                )
                                if not ocr_entries:
                                    continue

                                # Discard low-confidence noise tokens (< 0.35)
                                valid_entries = [e for e in ocr_entries if float(e[2]) >= 0.35]
                                if not valid_entries:
                                    continue

                                # Sort entries top-to-bottom (row 1 vs row 2 for 2-line plates), then left-to-right
                                valid_entries.sort(key=lambda e: (int(np.mean(np.array(e[0])[:, 1]) // 18), np.mean(np.array(e[0])[:, 0])))

                                # 1. Try joined text
                                joined_text = " ".join([e[1] for e in valid_entries])
                                fmt, is_v = cls.format_number_plate(joined_text)
                                matched_confs = [float(e[2]) for e in valid_entries]

                                # 2. Try individual entries if joined didn't match
                                if not is_v:
                                    for _, text, c_val in valid_entries:
                                        fmt_s, is_s = cls.format_number_plate(text)
                                        if is_s:
                                            fmt, is_v = fmt_s, True
                                            matched_confs = [float(c_val)]
                                            break

                                # 3. Try adjacent pairs
                                if not is_v and len(valid_entries) >= 2:
                                    for i in range(len(valid_entries)):
                                        for j in range(i + 1, min(i + 3, len(valid_entries))):
                                            pair_txt = f"{valid_entries[i][1]} {valid_entries[j][1]}"
                                            fmt_p, is_p = cls.format_number_plate(pair_txt)
                                            if is_p:
                                                fmt, is_v = fmt_p, True
                                                matched_confs = [float(valid_entries[i][2]), float(valid_entries[j][2])]
                                                break
                                        if is_v:
                                            break

                                if is_v:
                                    avg_ocr = float(np.mean(matched_confs)) if matched_confs else 0.8
                                    if avg_ocr >= 0.40:
                                        best_plate = fmt
                                        best_valid = True
                                        best_conf = round(float(p_conf * 0.35 + avg_ocr * 0.65), 2)
                                        best_box = [x1, y1, x2, y2]
                                        raw_ocr_found = joined_text
                                        _, buffer = cv2.imencode('.jpg', plate_crop)
                                        cropped_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                                        break
                            except Exception:
                                pass

                    if best_valid:
                        break
            except Exception as e:
                logger.warning(f"[ANPR] Plate YOLO inference error: {e}")

        # Step 3: Vehicle classification fallback if plate was found but vehicle type wasn't determined by best.pt
        if best_valid and not vehicle_candidates and vehicle_model is not None:
            try:
                v_results = vehicle_model(img_yolo, imgsz=320, verbose=False, conf=0.20, classes=cls.VEHICLE_CLASSES)
                px1, py1, px2, py2 = best_box
                px_center = ((px1 + px2) / 2) * scale_yolo
                py_center = ((py1 + py2) / 2) * scale_yolo
                best_enclosing_veh = None

                for res in v_results:
                    for box in res.boxes:
                        v_conf = float(box.conf[0])
                        cls_id = int(box.cls[0])
                        class_name = vehicle_model.names.get(cls_id, "car").lower()
                        class_name = "motorcycle" if "bike" in class_name or "motorcycle" in class_name else "truck" if "truck" in class_name else "bus" if "bus" in class_name else "car"
                        vx1, vy1, vx2, vy2 = map(int, box.xyxy[0])

                        margin_x = (vx2 - vx1) * 0.20
                        margin_y = (vy2 - vy1) * 0.20
                        if (vx1 - margin_x) <= px_center <= (vx2 + margin_x) and (vy1 - margin_y) <= py_center <= (vy2 + margin_y):
                            if best_enclosing_veh is None or v_conf > best_enclosing_veh["conf"]:
                                best_enclosing_veh = {"class": class_name, "conf": v_conf}

                if best_enclosing_veh:
                    detected_vehicle_type = best_enclosing_veh["class"]
            except Exception as e:
                logger.warning(f"[ANPR] Vehicle classification error: {e}")

        # Step 4: Fallback OCR for handheld plates or uploaded cropped plate images
        # ONLY run if NOT in live stream mode (prevents background room/screen false detections)
        if not best_valid and not is_live_stream and reader is not None:
            try:
                # 4a. Check if the entire uploaded image is a cropped plate
                img_ar = w / max(h, 1)
                if 1.2 <= img_ar <= 5.5 and w >= 80 and h >= 20:
                    variants = cls.get_plate_image_variants(img_bgr)
                    for var_img in variants[:2]:
                        try:
                            direct_entries = reader.readtext(var_img, detail=1, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ')
                            valid_entries = [e for e in direct_entries if float(e[2]) >= 0.40]
                            if valid_entries:
                                valid_entries.sort(key=lambda e: (int(np.mean(np.array(e[0])[:, 1]) // 18), np.mean(np.array(e[0])[:, 0])))
                                joined = " ".join([e[1] for e in valid_entries])
                                fmt, is_v = cls.format_number_plate(joined)
                                if is_v:
                                    best_plate = fmt
                                    best_valid = True
                                    avg_c = float(np.mean([float(e[2]) for e in valid_entries]))
                                    best_conf = round(avg_c, 2)
                                    best_box = [0, 0, w, h]
                                    raw_ocr_found = joined
                                    _, buffer = cv2.imencode('.jpg', img_bgr)
                                    cropped_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                                    break
                        except Exception:
                            pass

                # 4b. Fallback text search for uploaded photos where YOLO missed plate
                if not best_valid:
                    scale_fb = min(1.0, 640.0 / max(h, w))
                    img_fb = cv2.resize(img_bgr, None, fx=scale_fb, fy=scale_fb, interpolation=cv2.INTER_LINEAR) if scale_fb < 1.0 else img_bgr
                    direct_entries = reader.readtext(img_fb, detail=1, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ')
                    if direct_entries:
                        high_conf_entries = [e for e in direct_entries if float(e[2]) >= 0.55]
                        high_conf_entries.sort(key=lambda e: (np.mean(np.array(e[0])[:, 1]) // 20, np.mean(np.array(e[0])[:, 0])))

                        # Check individual high-confidence entries
                        for bbox, entry_text, entry_conf in high_conf_entries:
                            formatted, is_valid = cls.format_number_plate(entry_text)
                            if is_valid:
                                best_plate = formatted
                                best_valid = True
                                best_conf = round(float(entry_conf), 2)
                                raw_ocr_found = entry_text

                                pts = np.array(bbox, dtype=np.int32)
                                bx1, by1 = int(np.min(pts[:, 0]) / scale_fb), int(np.min(pts[:, 1]) / scale_fb)
                                bx2, by2 = int(np.max(pts[:, 0]) / scale_fb), int(np.max(pts[:, 1]) / scale_fb)
                                pad_w = int((bx2 - bx1) * 0.12)
                                pad_h = int((by2 - by1) * 0.15)
                                bx1, by1 = max(0, bx1 - pad_w), max(0, by1 - pad_h)
                                bx2, by2 = min(w, bx2 + pad_w), min(h, by2 + pad_h)
                                best_box = [bx1, by1, bx2, by2]

                                crop = img_bgr[by1:by2, bx1:bx2]
                                if crop.size > 0:
                                    _, buffer = cv2.imencode('.jpg', crop)
                                    cropped_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                                break

                        # Check adjacent pairs
                        if not best_valid and len(high_conf_entries) >= 2:
                            for i in range(len(high_conf_entries)):
                                for j in range(i + 1, min(i + 3, len(high_conf_entries))):
                                    combined = f"{high_conf_entries[i][1]} {high_conf_entries[j][1]}"
                                    formatted, is_valid = cls.format_number_plate(combined)
                                    if is_valid:
                                        best_plate = formatted
                                        best_valid = True
                                        best_conf = round(float((high_conf_entries[i][2] + high_conf_entries[j][2]) / 2), 2)
                                        raw_ocr_found = combined

                                        pts_i = np.array(high_conf_entries[i][0], dtype=np.int32)
                                        pts_j = np.array(high_conf_entries[j][0], dtype=np.int32)
                                        all_pts = np.vstack([pts_i, pts_j])
                                        bx1, by1 = int(np.min(all_pts[:, 0]) / scale_fb), int(np.min(all_pts[:, 1]) / scale_fb)
                                        bx2, by2 = int(np.max(all_pts[:, 0]) / scale_fb), int(np.max(all_pts[:, 1]) / scale_fb)
                                        pad_w = int((bx2 - bx1) * 0.12)
                                        pad_h = int((by2 - by1) * 0.15)
                                        bx1, by1 = max(0, bx1 - pad_w), max(0, by1 - pad_h)
                                        bx2, by2 = min(w, bx2 + pad_w), min(h, by2 + pad_h)
                                        best_box = [bx1, by1, bx2, by2]

                                        crop = img_bgr[by1:by2, bx1:bx2]
                                        if crop.size > 0:
                                            _, buffer = cv2.imencode('.jpg', crop)
                                            cropped_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                                        break
                                if best_valid:
                                    break
            except Exception as e:
                logger.warning(f"[ANPR] Fallback OCR error: {e}")

        # If not a verified standard plate, do not return garbage text
        if not best_valid:
            best_plate = ""

        return {
            "plate": best_plate,
            "number_plate": best_plate,
            "vehicle_type": detected_vehicle_type,
            "confidence": best_conf if best_valid else 0.0,
            "bounding_box": best_box,
            "is_valid_format": best_valid,
            "cropped_plate_base64": cropped_b64,
            "raw_ocr_text": raw_ocr_found
        }

    @classmethod
    async def list_vehicles(
        cls,
        db: AsyncSession,
        search: Optional[str] = None,
        vehicle_type: Optional[str] = None,
        camera_name: Optional[str] = None,
        location_spot: Optional[str] = None,
        date_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[int, List[VehicleRecord]]:
        """
        Retrieves list of vehicle records with filters.
        """
        query = select(VehicleRecord).order_by(desc(VehicleRecord.timestamp))

        if search:
            search_clean = f"%{search.strip().upper()}%"
            query = query.where(VehicleRecord.number_plate.ilike(search_clean))

        if vehicle_type and vehicle_type != "all":
            query = query.where(VehicleRecord.vehicle_type == vehicle_type.lower())

        if camera_name and camera_name != "all":
            query = query.where(VehicleRecord.camera_name == camera_name)

        if location_spot and location_spot != "all":
            query = query.where(VehicleRecord.location_spot == location_spot)

        if date_filter:
            query = query.where(func.strftime('%Y-%m-%d', VehicleRecord.timestamp) == date_filter)

        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one_or_none() or 0

        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        records = list(result.scalars().all())

        return total, records

    @classmethod
    async def get_stats(cls, db: AsyncSession) -> VehicleStats:
        """
        Calculates daily ANPR statistics.
        """
        total_res = await db.execute(select(func.count(VehicleRecord.id)))
        total_vehicles = total_res.scalar_one_or_none() or 0

        unique_res = await db.execute(select(func.count(func.distinct(VehicleRecord.number_plate))))
        unique_plates = unique_res.scalar_one_or_none() or 0

        cars_res = await db.execute(select(func.count(VehicleRecord.id)).where(VehicleRecord.vehicle_type == "car"))
        car_count = cars_res.scalar_one_or_none() or 0

        trucks_res = await db.execute(select(func.count(VehicleRecord.id)).where(VehicleRecord.vehicle_type == "truck"))
        truck_count = trucks_res.scalar_one_or_none() or 0

        buses_res = await db.execute(select(func.count(VehicleRecord.id)).where(VehicleRecord.vehicle_type == "bus"))
        bus_count = buses_res.scalar_one_or_none() or 0

        bikes_res = await db.execute(select(func.count(VehicleRecord.id)).where(VehicleRecord.vehicle_type == "motorcycle"))
        motorcycle_count = bikes_res.scalar_one_or_none() or 0

        watchlist_res = await db.execute(select(func.count(VehicleRecord.id)).where(VehicleRecord.confidence < 0.60))
        watchlist_hits = watchlist_res.scalar_one_or_none() or 0

        return VehicleStats(
            total_vehicles=total_vehicles,
            unique_plates=unique_plates,
            watchlist_hits=watchlist_hits,
            car_count=car_count,
            truck_count=truck_count,
            bus_count=bus_count,
            motorcycle_count=motorcycle_count
        )

    @classmethod
    async def scan_and_save(
        cls,
        db: AsyncSession,
        image_base64: Optional[str] = None,
        manual_plate: Optional[str] = None,
        vehicle_type: Optional[str] = None,
        camera_name: str = "Live ANPR Camera",
        location_spot: str = "Apartment Main Gate",
        is_live_stream: bool = False
    ) -> Tuple[bool, Optional[VehicleRecord], str, Dict[str, Any]]:
        """
        Processes AI license plate scanning (YOLO best.pt + EasyOCR) and saves to database.
        Returns: (success: bool, record: Optional[VehicleRecord], message: str, detection_details: Dict)
        """
        number_plate = ""
        confidence = 0.95
        detected_type = vehicle_type.lower() if vehicle_type else "car"
        detection_details = {
            "bounding_box": None,
            "cropped_plate_base64": None,
            "is_valid_format": False,
            "raw_ocr_text": None
        }

        # Case 1: Direct / Manual Plate Input
        if manual_plate and manual_plate.strip():
            formatted, is_valid = cls.format_number_plate(manual_plate.strip())
            number_plate = formatted or re.sub(r'[^A-Za-z0-9]', '', manual_plate.strip()).upper()
            confidence = 0.99
            detection_details["is_valid_format"] = is_valid
        
        # Case 2: Base64 Image Processing with YOLO + OCR
        elif image_base64:
            try:
                clean_b64 = image_base64
                if "," in image_base64:
                    clean_b64 = image_base64.split(",", 1)[1]
                
                image_bytes = base64.b64decode(clean_b64)
                np_arr = np.frombuffer(image_bytes, np.uint8)
                img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if img_bgr is None:
                    return False, None, "Invalid image format received.", detection_details

                det = cls._detect_and_read_plate(img_bgr, is_live_stream=is_live_stream)
                if det["plate"]:
                    number_plate = det["plate"]
                    confidence = det["confidence"]
                    detected_type = det.get("vehicle_type") or (vehicle_type.lower() if vehicle_type else "car")
                    detection_details["vehicle_type"] = detected_type
                    detection_details["bounding_box"] = det["bounding_box"]
                    detection_details["cropped_plate_base64"] = det["cropped_plate_base64"]
                    detection_details["is_valid_format"] = det["is_valid_format"]
                    detection_details["raw_ocr_text"] = det["raw_ocr_text"]
                else:
                    return False, None, "No license plate detected in camera frame. Please show plate clearly.", detection_details

            except Exception as err:
                logger.error(f"[ANPR] Image processing failed: {err}", exc_info=True)
                return False, None, f"Image processing error: {str(err)}", detection_details
        else:
            return False, None, "No image frame or license plate provided.", detection_details

        # Strict validation: Do not save to database unless it is a verified format and full 8, 9, or 10 characters
        is_valid_format = detection_details.get("is_valid_format", False)
        plate_length = len(number_plate)

        if not is_valid_format or plate_length not in (8, 9, 10):
            msg = f"Plate '{number_plate}' is not a valid Indian registration format. Only verified RTO standard plates are saved."
            return False, None, msg, detection_details

        # Enterprise Multi-Frame Temporal Consensus Voting for live camera feeds:
        if is_live_stream and number_plate:
            import time
            now_ts = time.time()
            cam_key = f"{camera_name}_{location_spot}"
            if cam_key not in cls._temporal_buffers:
                cls._temporal_buffers[cam_key] = []

            # Prune buffer entries older than temporal window (2.5s)
            cls._temporal_buffers[cam_key] = [
                e for e in cls._temporal_buffers[cam_key]
                if (now_ts - e['timestamp']) <= cls.TEMPORAL_WINDOW_SECONDS
            ]

            cls._temporal_buffers[cam_key].append({
                'timestamp': now_ts,
                'plate': number_plate,
                'conf': confidence
            })

            recent_plates = [e['plate'] for e in cls._temporal_buffers[cam_key]]
            if len(recent_plates) >= 2:
                consensus_p, agree_ratio = cls._compute_consensus_plate(recent_plates)
                formatted_c, is_v_c = cls.format_number_plate(consensus_p)
                if is_v_c:
                    number_plate = formatted_c
                    confidence = round(float(confidence * 0.4 + agree_ratio * 0.6), 2)
                    detection_details["consensus_plate"] = number_plate
                    detection_details["consensus_frames"] = len(recent_plates)
                    detection_details["is_valid_format"] = True

        # Enterprise Access Control & Security Classification (Resident, VIP, Blacklist, Visitor)
        sec_info = cls.check_security_status(number_plate)
        detection_details["security_status"] = sec_info

        # Duplicate Prevention: Check if this number plate is already saved in the database
        existing_query = select(VehicleRecord).where(VehicleRecord.number_plate == number_plate).order_by(desc(VehicleRecord.timestamp)).limit(1)
        existing_res = await db.execute(existing_query)
        existing_record = existing_res.scalar_one_or_none()

        if existing_record:
            # Plate is already saved in database! Do NOT insert duplicate row!
            msg = f"Vehicle plate '{number_plate}' already exists in database. Duplicate not saved."
            detection_details["already_saved"] = True
            return True, existing_record, msg, detection_details

        detection_details["already_saved"] = False

        # Save permanently to SQLite database
        evidence_file = f"evidence_{number_plate.lower()}_{int(datetime.now(timezone.utc).timestamp())}.jpg"
        record = VehicleRecord(
            id=uuid.uuid4(),
            number_plate=number_plate,
            vehicle_type=detected_type,
            confidence=confidence,
            camera_name=camera_name,
            location_spot=location_spot,
            evidence_reference=evidence_file,
            timestamp=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc)
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)

        msg = f"Vehicle plate '{number_plate}' scanned & saved to database at {location_spot}."
        return True, record, msg, detection_details

    @classmethod
    async def create_vehicle(cls, db: AsyncSession, data: VehicleCreate) -> VehicleRecord:
        """
        Manually creates a vehicle record in the database, avoiding duplicates.
        """
        formatted_plate = re.sub(r'[^A-Za-z0-9]', '', data.number_plate.strip()).upper()

        existing = await db.execute(select(VehicleRecord).where(VehicleRecord.number_plate == formatted_plate).limit(1))
        existing_rec = existing.scalar_one_or_none()
        if existing_rec:
            return existing_rec

        record = VehicleRecord(
            id=uuid.uuid4(),
            number_plate=formatted_plate,
            vehicle_type=data.vehicle_type.lower(),
            confidence=data.confidence,
            camera_name=data.camera_name,
            location_spot=data.location_spot,
            evidence_reference=data.evidence_reference or f"evidence_{formatted_plate.lower()}.jpg",
            timestamp=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc)
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    @classmethod
    async def delete_vehicle(cls, db: AsyncSession, vehicle_id: uuid.UUID) -> bool:
        """
        Deletes a vehicle record from the database.
        """
        res = await db.execute(delete(VehicleRecord).where(VehicleRecord.id == vehicle_id))
        await db.commit()
        return res.rowcount > 0

    @classmethod
    async def clear_all_vehicles(cls, db: AsyncSession) -> int:
        """
        Deletes ALL vehicle records from the database table.
        """
        res = await db.execute(delete(VehicleRecord))
        await db.commit()
        return res.rowcount
