"""
Awiros Local Worker Client.
Runs in the main backend environment (Python 3.14 / FastAPI).
Communicates with the persistent local Awiros OCR worker running in Python 3.11.
Requires zero PaddlePaddle dependencies in the main FastAPI environment.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

WORKER_URL = os.getenv("AWIROS_WORKER_URL", "http://127.0.0.1:8008")

# Check for portable project-internal worker script first, then fallback to external sandbox
INTERNAL_WORKER = Path(__file__).resolve().parent / "awiros_worker" / "worker.py"
INTERNAL_VENV_PY = Path(__file__).resolve().parent / "awiros_worker" / "venv" / "Scripts" / "python.exe"
INTERNAL_VENV_LINUX = Path(__file__).resolve().parent / "awiros_worker" / "venv" / "bin" / "python"

if INTERNAL_WORKER.exists():
    WORKER_SCRIPT = INTERNAL_WORKER
else:
    WORKER_SCRIPT = Path(r"C:\Users\RAMEEZ\Downloads\awiros_standalone_test\awiros_worker_server.py")

if INTERNAL_VENV_PY.exists():
    PYTHON_311_EXE = INTERNAL_VENV_PY
elif INTERNAL_VENV_LINUX.exists():
    PYTHON_311_EXE = INTERNAL_VENV_LINUX
else:
    PYTHON_311_EXE = Path(r"C:\Users\RAMEEZ\Downloads\awiros_standalone_test\venv\Scripts\python.exe")


class AwirosClient:
    """Client for communicating with the local isolated Awiros OCR worker."""

    _process: Optional[subprocess.Popen] = None

    @classmethod
    def is_healthy(cls) -> bool:
        """Checks if the local Awiros worker is responsive."""
        try:
            req = urllib.request.Request(f"{WORKER_URL}/health", method="GET")
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data.get("status") == "ready"
        except Exception:
            return False
        return False

    @classmethod
    def ensure_worker(cls) -> bool:
        """Ensures the Awiros worker is running. Spawns it if not active."""
        if cls.is_healthy():
            return True

        if not PYTHON_311_EXE.exists() or not WORKER_SCRIPT.exists():
            logger.warning(
                f"[AwirosClient] Cannot spawn worker: Python 3.11 venv ({PYTHON_311_EXE}) "
                f"or worker script ({WORKER_SCRIPT}) not found."
            )
            return False

        logger.info("[AwirosClient] Launching isolated Awiros worker process...")
        try:
            # Spawn detached daemon worker
            creationflags = 0
            if os.name == "nt":
                creationflags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS

            cls._process = subprocess.Popen(
                [str(PYTHON_311_EXE), str(WORKER_SCRIPT), "--port", "8008"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags
            )

            # Wait for worker to warm up (up to 8 seconds)
            for _ in range(16):
                time.sleep(0.5)
                if cls.is_healthy():
                    logger.info("[AwirosClient] Awiros worker successfully started and healthy.")
                    return True

            logger.warning("[AwirosClient] Worker spawned but timed out waiting for /health.")
            return False
        except Exception as e:
            logger.error(f"[AwirosClient] Failed to spawn Awiros worker: {e}", exc_info=True)
            return False

    @classmethod
    def predict_plate(cls, crop_bgr: np.ndarray, timeout_sec: float = 6.0) -> Optional[Dict[str, Any]]:
        """
        Sends cropped plate image to local Awiros worker for layout-aware OCR.
        Returns dict with keys: success, plate, raw_plate, confidence, is_valid_format, latency_ms.
        Returns None if worker is unreachable or fails (triggering fallback).
        """
        if not cls.ensure_worker():
            return None

        try:
            # Encode image to JPEG
            ok, buf = cv2.imencode(".jpg", crop_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            if not ok:
                return None
            b64_str = base64.b64encode(buf).decode("utf-8")

            payload = json.dumps({"image_b64": b64_str}).encode("utf-8")
            req = urllib.request.Request(
                f"{WORKER_URL}/ocr",
                data=payload,
                headers={"Content-Type": "application/json", "Connection": "close"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    if data.get("success"):
                        return data
        except Exception as e:
            logger.warning(f"[AwirosClient] OCR prediction request failed: {e}")
            return None

        return None


awiros_client = AwirosClient

