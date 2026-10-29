"""
Awiros ANPR OCR Persistent Local Worker Service.
Runs strictly inside an isolated Python 3.11 + PaddlePaddle environment.
Provides a high-performance, non-blocking HTTP micro-endpoint on 127.0.0.1:8008.
Eliminates startup latency and memory thrashing by caching the model in RAM.
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import sys
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Dict, Any, Tuple

import cv2
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [AwirosWorker] %(message)s"
)
logger = logging.getLogger("AwirosWorker")

# Resolve model and PaddleOCR directories
BASE_DIR = Path(__file__).resolve().parent

# Check environment variable first, then fallback locations
ENV_MODEL_DIR = os.getenv("AWIROS_MODEL_DIR")
if ENV_MODEL_DIR and Path(ENV_MODEL_DIR).exists():
    AWIROS_DIR = Path(ENV_MODEL_DIR)
elif (BASE_DIR / "awiros_model").exists():
    AWIROS_DIR = BASE_DIR / "awiros_model"
elif Path(r"C:\Users\RAMEEZ\Downloads\awiros_standalone_test\awiros_model").exists():
    AWIROS_DIR = Path(r"C:\Users\RAMEEZ\Downloads\awiros_standalone_test\awiros_model")
else:
    AWIROS_DIR = BASE_DIR / "models"

PADDLEOCR_DIR = AWIROS_DIR / "PaddleOCR"
if PADDLEOCR_DIR.exists() and str(PADDLEOCR_DIR) not in sys.path:
    sys.path.insert(0, str(PADDLEOCR_DIR))

try:
    import paddle
    from ppocr.modeling.architectures import build_model as ppocr_build_model
    from ppocr.postprocess import build_post_process
    from safetensors.numpy import load_file
except ImportError as e:
    logger.error(
        f"Critical import failure: {e}. "
        f"Ensure this worker is executed within the dedicated Python 3.11 virtualenv."
    )

CTC_NUM_CLASSES = 64
NRTR_NUM_CLASSES = 67

MODEL_CONFIG = {
    "Architecture": {
        "model_type": "rec",
        "algorithm": "SVTR_LCNet",
        "Transform": None,
        "Backbone": {
            "name": "PPLCNetV3",
            "scale": 0.95,
            "pretrained": False,
            "large_stride": [3, 2, 2],
        },
        "Head": {
            "name": "MultiHead",
            "head_list": [
                {
                    "CTCHead": {
                        "Neck": {
                            "name": "svtr",
                            "dims": 120,
                            "depth": 2,
                            "hidden_dims": 120,
                            "use_guide": True,
                        },
                        "Head": {
                            "fc_decay": 1e-05,
                            "out_channels_list": {
                                "CTCLabelDecode": CTC_NUM_CLASSES
                            },
                        },
                    }
                },
                {
                    "NRTRHead": {
                        "nrtr_dim": 384,
                        "max_text_length": 25,
                        "num_decoder_layers": 4,
                        "num_heads": 6,
                        "out_channels": NRTR_NUM_CLASSES,
                    }
                },
            ],
        },
    }
}

IMAGE_SHAPE = [3, 48, 320]

INDIAN_STATES = {
    'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN',
    'GA', 'GJ', 'HR', 'HP', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
    'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ',
    'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'UA', 'WB'
}

DIGIT_TO_CHAR = {'0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '8': 'B'}
CHAR_TO_DIGIT = {'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '2', 'A': '4', 'S': '5', 'G': '6', 'B': '8', 'T': '7'}

def normalize_plate(text: str) -> str:
    return "".join(c for c in text.upper() if c.isalnum())

def format_number_plate(raw_text: str) -> Tuple[str, bool]:
    cleaned = normalize_plate(raw_text)
    for prefix in ["INDIA", "1NDIA", "IND", "1ND", "LND", "IN0", "HSRP", "GOVT", "POLICE"]:
        if cleaned.startswith(prefix) and (len(cleaned) - len(prefix)) in (8, 9, 10):
            cleaned = cleaned[len(prefix):]
            break
    if len(cleaned) not in (8, 9, 10):
        return cleaned, False
    
    # Standard format validation
    if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$", cleaned):
        return cleaned, True
    if re.match(r"^DL[0-9]{1}[A-Z]{1,3}[0-9]{4}$", cleaned):
        return cleaned, True
    if re.match(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$", cleaned):
        return cleaned, True

    # Positional character-digit corrections
    if len(cleaned) == 10:
        st = cleaned[:2]
        rto = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[2:4])
        s = "".join(DIGIT_TO_CHAR.get(c, c) for c in cleaned[4:6])
        u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[6:10])
        cand = st + rto + s + u
        if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$", cand) and st in INDIAN_STATES:
            return cand, True
        if st == "DL":
            cand_dl = "DL" + CHAR_TO_DIGIT.get(cleaned[2], cleaned[2]) + "".join(DIGIT_TO_CHAR.get(c, c) for c in cleaned[3:6]) + u
            if re.match(r"^DL[0-9]{1}[A-Z]{3}[0-9]{4}$", cand_dl):
                return cand_dl, True

    if len(cleaned) == 9:
        st = cleaned[:2]
        rto = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[2:4])
        s = DIGIT_TO_CHAR.get(cleaned[4], cleaned[4])
        u = "".join(CHAR_TO_DIGIT.get(c, c) for c in cleaned[5:9])
        cand = st + rto + s + u
        if re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{4}$", cand) and st in INDIAN_STATES:
            return cand, True

    return cleaned, False

class AwirosModelRunner:
    """Manages PaddlePaddle model inference and preprocessing."""
    def __init__(self, device: str = "cpu"):
        self.device = device
        paddle.set_device(self.device)
        self.weights_path = str(AWIROS_DIR / "model.safetensors")
        self.dict_path = str(AWIROS_DIR / "en_dict.txt")

        if not Path(self.weights_path).exists():
            raise FileNotFoundError(f"Awiros model weights not found at: {self.weights_path}")
        if not Path(self.dict_path).exists():
            raise FileNotFoundError(f"Character dictionary not found at: {self.dict_path}")

        logger.info(f"Loading Awiros model from {self.weights_path}...")
        t0 = time.perf_counter()
        self.post_process = build_post_process({
            "name": "CTCLabelDecode",
            "character_dict_path": self.dict_path,
            "use_space_char": True,
        })
        self.model = ppocr_build_model(MODEL_CONFIG["Architecture"])
        self.model.eval()

        np_state = load_file(self.weights_path)
        self.model.set_state_dict({k: paddle.to_tensor(v) for k, v in np_state.items()})
        elapsed = (time.perf_counter() - t0) * 1000
        logger.info(f"Awiros model successfully loaded in {elapsed:.1f} ms.")

        # Warmup pass
        dummy = paddle.to_tensor(np.zeros((1, 3, 48, 320), dtype=np.float32))
        with paddle.no_grad():
            _ = self.model(dummy)
        logger.info("Warmup complete. Worker ready.")

    def _resize_for_rec(self, img_bgr: np.ndarray) -> np.ndarray:
        _, h, w = IMAGE_SHAPE
        img_h, img_w = img_bgr.shape[:2]
        ratio = h / max(img_h, 1)
        new_w = min(int(img_w * ratio), w)
        resized = cv2.resize(img_bgr, (new_w, h), interpolation=cv2.INTER_CUBIC)
        if new_w < w:
            padded = np.zeros((h, w, 3), dtype=np.uint8)
            padded[:, :new_w, :] = resized
            resized = padded
        return resized

    def _preprocess(self, img_bgr: np.ndarray) -> np.ndarray:
        img = self._resize_for_rec(img_bgr)
        img = img.astype(np.float32) / 255.0
        img = (img - 0.5) / 0.5
        return img.transpose((2, 0, 1))

    def _predict_tensor(self, img_bgr: np.ndarray) -> Tuple[str, float]:
        inp = np.expand_dims(self._preprocess(img_bgr), axis=0)
        with paddle.no_grad():
            preds = self.model(paddle.to_tensor(inp))
        if isinstance(preds, (list, tuple)):
            pred_tensor = preds[0]
        elif isinstance(preds, dict):
            pred_tensor = preds.get("ctc", next(iter(preds.values())))
        else:
            pred_tensor = preds
        res = self.post_process(pred_tensor.numpy())
        if res and len(res) > 0:
            return res[0][0].strip().upper(), float(res[0][1])
        return "", 0.0

    def _apply_clahe(self, img_bgr: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        cl = clahe.apply(l)
        merged = cv2.merge((cl, a, b))
        return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

    def predict_enhanced(self, img_bgr: np.ndarray) -> Dict[str, Any]:
        t0 = time.perf_counter()
        h, w = img_bgr.shape[:2]
        ar = w / float(max(h, 1))

        candidates = []

        # 1. Direct prediction
        txt_d, conf_d = self._predict_tensor(img_bgr)
        fmt_d, is_v_d = format_number_plate(txt_d)
        
        # Fast-path: return immediately if direct crop has high confidence & valid format
        if is_v_d and conf_d >= 0.96:
            latency_ms = (time.perf_counter() - t0) * 1000
            return {
                "success": True,
                "plate": fmt_d,
                "raw_plate": txt_d,
                "confidence": round(float(conf_d), 4),
                "is_valid_format": True,
                "method": "direct_fastpath",
                "latency_ms": round(latency_ms, 2)
            }

        candidates.append((txt_d, conf_d, "direct"))

        # 2. Layout-aware handling: 2-line layout (aspect ratio < 2.2)
        if ar < 2.2:
            top_half = img_bgr[:int(h * 0.55), :]
            bot_half = img_bgr[int(h * 0.45):, :]
            target_h = 48
            top_w = max(1, int(top_half.shape[1] * (target_h / max(top_half.shape[0], 1))))
            bot_w = max(1, int(bot_half.shape[1] * (target_h / max(bot_half.shape[0], 1))))
            top_s = cv2.resize(top_half, (top_w, target_h), interpolation=cv2.INTER_CUBIC)
            bot_s = cv2.resize(bot_half, (bot_w, target_h), interpolation=cv2.INTER_CUBIC)
            stitched = np.hstack([top_s, bot_s])
            
            txt_s, conf_s = self._predict_tensor(stitched)
            candidates.append((txt_s, conf_s, "stitched_2line"))

            stitched_clahe = self._apply_clahe(stitched)
            txt_sc, conf_sc = self._predict_tensor(stitched_clahe)
            candidates.append((txt_sc, conf_sc, "stitched_clahe"))
        else:
            clahe_img = self._apply_clahe(img_bgr)
            txt_c, conf_c = self._predict_tensor(clahe_img)
            candidates.append((txt_c, conf_c, "clahe"))

        # Select best valid candidate
        valid_candidates = []
        for txt, conf, method in candidates:
            fmt, is_v = format_number_plate(txt)
            if is_v:
                valid_candidates.append((fmt, txt, conf, method, True))

        if valid_candidates:
            valid_candidates.sort(key=lambda x: (len(x[0]) == 10, x[2]), reverse=True)
            best_plate, raw_plate, best_conf, best_method, is_valid = valid_candidates[0]
        else:
            candidates.sort(key=lambda x: x[1], reverse=True)
            raw_plate, best_conf, best_method = candidates[0]
            best_plate = normalize_plate(raw_plate)
            is_valid = False

        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "success": True,
            "plate": best_plate,
            "raw_plate": raw_plate,
            "confidence": round(float(best_conf), 4),
            "is_valid_format": is_valid,
            "method": best_method,
            "latency_ms": round(latency_ms, 2)
        }

runner: AwirosModelRunner | None = None

class AwirosHTTPRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self.close_connection = True
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Connection", "close")
            self.end_headers()
            resp = json.dumps({"status": "ready", "model": "awiros_anpr_ocr", "device": "cpu"}).encode("utf-8")
            self.wfile.write(resp)
        else:
            self.send_response(404)
            self.send_header("Connection", "close")
            self.end_headers()

    def do_POST(self):
        self.close_connection = True
        if self.path == "/ocr":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                img_b64 = data.get("image_b64")
                if not img_b64:
                    raise ValueError("Missing 'image_b64' field")
                
                if "," in img_b64:
                    img_b64 = img_b64.split(",", 1)[1]
                img_bytes = base64.b64decode(img_b64)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if img is None:
                    raise ValueError("Failed to decode image from base64")

                result = runner.predict_enhanced(img)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                logger.error(f"Error handling /ocr: {e}", exc_info=True)
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
        elif self.path == "/shutdown":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "shutting_down"}).encode("utf-8"))
            def shutdown_server():
                time.sleep(0.5)
                sys.exit(0)
            import threading
            threading.Thread(target=shutdown_server).start()
        else:
            self.send_response(404)
            self.send_header("Connection", "close")
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress noisy standard request logging in production
        pass

def run_server(port: int = 8008):
    global runner
    runner = AwirosModelRunner(device="cpu")
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, AwirosHTTPRequestHandler)
    httpd.daemon_threads = True
    logger.info(f"Serving Awiros ANPR OCR Worker on http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Worker stopped by keyboard interrupt.")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8008, help="Worker HTTP port")
    args = parser.parse_args()
    run_server(args.port)

