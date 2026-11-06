"""
Facenox AI Surveillance & Biometric Engine
Integrated from facenox/facenox (Open-Source Offline-First Biometric Platform).

Provides:
  1. FaceDetector: OpenCV YuNet SOTA lightweight face detector with 5-point facial landmarks.
  2. LivenessDetector: MiniFASNetV2 ONNX anti-spoofing classifier (Passive & multi-frame liveness).
  3. FaceRecognizer: SOTA ArcFace ONNX model extracting 512-dimensional normalized embeddings.
  4. FaceTracker: Multi-subject ByteTrack tracker with Kalman filtering.
  5. Vectorized Cosine Matcher: Sub-millisecond matching against employee roster.
"""

import os
import base64
import logging
import time
from typing import Dict, List, Optional, Tuple, Any

import cv2
import numpy as np

from app.core.ai.facenox import FaceDetector, LivenessDetector, FaceRecognizer, FaceTracker
from app.core.ai.facenox.face_recognizer.preprocess import align_faces_batch

logger = logging.getLogger(__name__)

# Base paths for Facenox models
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS_DIR = os.path.join(BACKEND_DIR, "models", "facenox")
DETECTOR_PATH = os.path.join(MODELS_DIR, "detector.onnx")
LIVENESS_PATH = os.path.join(MODELS_DIR, "liveness.onnx")
RECOGNIZER_PATH = os.path.join(MODELS_DIR, "recognizer.onnx")


class FacenoxEngine:
    """
    Unified Facenox Biometric Service.
    Singleton service initialized once for low-latency in-memory inference.
    """

    def __init__(self):
        self.is_ready = False
        self.detector: Optional[FaceDetector] = None
        self.liveness: Optional[LivenessDetector] = None
        self.recognizer: Optional[FaceRecognizer] = None
        self.tracker: Optional[FaceTracker] = None
        self._initialize()

    def _initialize(self):
        try:
            if not (os.path.isfile(DETECTOR_PATH) and os.path.isfile(LIVENESS_PATH) and os.path.isfile(RECOGNIZER_PATH)):
                logger.warning(
                    "Facenox model files not found at %s. Face recognition will run in fallback mode.",
                    MODELS_DIR
                )
                return

            # 1. Initialize FaceDetectorYN
            self.detector = FaceDetector(
                model_path=DETECTOR_PATH,
                input_size=(640, 640),
                conf_threshold=0.50,
                nms_threshold=0.30,
                top_k=5000,
                min_face_size=24,
            )

            # 2. Initialize ByteTrack FaceTracker
            self.tracker = FaceTracker(
                track_thresh=0.50,
                match_thresh=0.75,
                track_buffer=30,
                frame_rate=30,
            )

            # 3. Initialize Liveness / Anti-Spoofing Detector
            self.liveness = LivenessDetector(
                model_path=LIVENESS_PATH,
                pass_margin=1.5,
                spoof_margin=0.0,
                required_real_frames=2,
            )

            # 4. Initialize ArcFace 512-d Recognizer
            self.recognizer = FaceRecognizer(
                model_path=RECOGNIZER_PATH,
                input_size=(112, 112),
                similarity_threshold=0.55,
                providers=["CPUExecutionProvider"],
                legacy_database_path=None,
                session_options=None,
            )

            self.is_ready = True
            logger.info("Facenox AI Biometric Engine initialized successfully (YuNet + AntiSpoof + ArcFace).")
        except Exception as exc:
            logger.error(f"Failed to initialize Facenox AI Engine: {exc}", exc_info=True)
            self.is_ready = False

    @staticmethod
    def decode_image(image_input: Any) -> Optional[np.ndarray]:
        """Convert base64 string, bytes, or buffer to OpenCV BGR numpy array."""
        try:
            if isinstance(image_input, np.ndarray):
                return image_input

            if isinstance(image_input, str):
                if "," in image_input:
                    image_input = image_input.split(",", 1)[1]
                data = base64.b64decode(image_input)
            elif isinstance(image_input, bytes):
                data = image_input
            else:
                return None

            nparr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as err:
            logger.warning(f"Failed to decode image for Facenox: {err}")
            return None

    async def extract_face_embedding(self, image: np.ndarray) -> Tuple[bool, Optional[List[float]], str]:
        """
        Extract 512-d normalized embedding for single-face enrollment.
        Validates that exactly 1 clear face exists in the frame.
        """
        if not self.is_ready or self.detector is None or self.recognizer is None:
            return False, None, "Facenox engine not initialized"

        if image is None or image.size == 0:
            return False, None, "Invalid or empty image"

        # Detect face
        faces = self.detector.detect_faces(image, enable_liveness=False)
        if not faces:
            return False, None, "No face detected in image. Please center your face in the camera."

        if len(faces) > 1:
            return False, None, "Multiple faces detected. Please ensure only one person is in the frame."

        face = faces[0]
        # Align and extract embedding
        embeddings = await self.recognizer._extract_embeddings(image, [face])
        if not embeddings or len(embeddings) == 0:
            return False, None, "Failed to extract facial biometric features."

        embedding_list = embeddings[0].tolist()
        return True, embedding_list, "Face features successfully extracted."

    async def scan_and_recognize_frame(
        self,
        image: np.ndarray,
        enrolled_employees: List[Dict[str, Any]],
        similarity_threshold: float = 0.55,
        enable_liveness: bool = True,
        client_id: Optional[str] = "default_cam",
    ) -> List[Dict[str, Any]]:
        """
        Complete Facenox pipeline on a video frame:
          1. Detects all faces + 5 landmarks
          2. Tracks faces with ByteTrack
          3. Evaluates Anti-Spoofing Liveness
          4. Extracts 512-d ArcFace embeddings
          5. Matches against enrolled employees using fast cosine similarity
        """
        if not self.is_ready or self.detector is None or self.recognizer is None:
            return []

        if image is None or image.size == 0:
            return []

        start_time = time.perf_counter()

        # Step 1: Face Detection
        faces = self.detector.detect_faces(image, enable_liveness=enable_liveness)
        if not faces:
            return []

        # Step 2: Multi-Subject ByteTrack
        if self.tracker:
            try:
                faces = self.tracker.update(faces)
            except Exception as e:
                logger.debug(f"ByteTrack update issue: {e}")

        # Step 3: Anti-Spoofing Liveness Check
        if enable_liveness and self.liveness:
            try:
                faces = self.liveness.detect_faces(image, faces, tracking_namespace=client_id)
            except Exception as exc:
                logger.debug(f"Liveness check issue: {exc}")

        # Step 4: Extract 512-d Embeddings for all detected faces
        embeddings = await self.recognizer._extract_embeddings(image, faces)

        # Prepare database matrix for vectorized matching
        db_embs: List[np.ndarray] = []
        db_records: List[Dict[str, Any]] = []

        for emp in enrolled_employees:
            enc = emp.get("face_encoding")
            if enc and len(enc) == 512:
                db_embs.append(np.array(enc, dtype=np.float32))
                db_records.append(emp)

        db_matrix = np.stack(db_embs) if db_embs else None

        results: List[Dict[str, Any]] = []

        for idx, face in enumerate(faces):
            box = face.get("bbox", {})
            track_id = face.get("track_id")
            landmarks = face.get("landmarks_5")
            liveness_info = face.get("liveness", {})

            # Liveness decision
            is_real = liveness_info.get("is_real", True) if isinstance(liveness_info, dict) else True
            liveness_status = liveness_info.get("status", "real") if isinstance(liveness_info, dict) else "real"
            liveness_conf = liveness_info.get("confidence", 0.98) if isinstance(liveness_info, dict) else 0.98

            matched_emp = None
            best_sim = 0.0

            # Match embedding
            if idx < len(embeddings) and db_matrix is not None and len(db_matrix) > 0:
                q_emb = embeddings[idx]  # Shape (512,)
                # Dot product of normalized embeddings = cosine similarity
                sims = np.dot(db_matrix, q_emb)
                best_idx = int(np.argmax(sims))
                best_sim = float(sims[best_idx])

                if best_sim >= similarity_threshold:
                    matched_emp = db_records[best_idx]

            results.append({
                "track_id": track_id,
                "bbox": box,
                "landmarks": landmarks,
                "liveness": {
                    "is_real": bool(is_real),
                    "status": liveness_status,
                    "confidence": round(float(liveness_conf), 3),
                },
                "match_found": bool(matched_emp is not None),
                "similarity": round(best_sim, 4),
                "confidence": round(min(1.0, max(0.0, (best_sim - similarity_threshold) / (1.0 - similarity_threshold) * 0.5 + 0.5)), 3) if matched_emp else 0.0,
                "employee": {
                    "id": str(matched_emp.get("id")),
                    "name": matched_emp.get("name"),
                    "employee_id": matched_emp.get("employee_id"),
                    "department": matched_emp.get("department"),
                    "designation": matched_emp.get("designation"),
                } if matched_emp else None,
            })

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        logger.debug("Facenox frame processed %d faces in %.2fms", len(results), elapsed_ms)
        return results


# Global singleton instance
facenox_engine = FacenoxEngine()

