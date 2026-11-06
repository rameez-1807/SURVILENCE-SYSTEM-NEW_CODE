"""
Biometric Vault - AES-256-GCM Template Encryption at Rest

Implements military-grade authenticated encryption for facial biometric embeddings
as mandated by privacy & surveillance compliance standards.
- Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
- Key Derivation: SHA-256 digest from application SECRET_KEY
- Nonce: Cryptographically secure 96-bit (12-byte) per-template nonce
- Zero raw embeddings logged to disk or console.
"""

import os
import json
import base64
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple, Dict
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

logger = logging.getLogger(__name__)

class BiometricVault:
    """Secure enclave for biometric template encryption, decryption, and validation."""

    def __init__(self, secret_key: Optional[str] = None):
        raw_secret = secret_key or settings.SECRET_KEY or "fallback-secure-biometric-key-32b!"
        # Derive fixed 256-bit (32-byte) encryption key using SHA-256
        self._key = hashlib.sha256(raw_secret.encode("utf-8")).digest()
        self._cipher = AESGCM(self._key)

    def encrypt(
        self,
        embedding: List[float],
        model_name: str = "facenox-arcface-512d",
        version: str = "1.0",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Encrypt a facial embedding vector at rest using AES-256-GCM.
        
        Returns a JSON-serializable dictionary containing:
          - encrypted: True
          - algorithm: "AES-256-GCM"
          - model: model_name
          - version: version
          - dim: embedding length (128 or 512)
          - nonce: base64 encoded 12-byte nonce
          - ciphertext: base64 encoded ciphertext + 16-byte authentication tag
          - enrolled_at: ISO 8601 UTC timestamp
        """
        if not embedding or not isinstance(embedding, (list, tuple)):
            raise ValueError("Embedding must be a non-empty list of floats.")

        dim = len(embedding)
        nonce = os.urandom(12)  # 96-bit unique nonce

        payload = {
            "embedding": [float(v) for v in embedding],
            "model": model_name,
            "version": version,
            "dim": dim,
            "enrolled_at": datetime.now(timezone.utc).isoformat(),
        }
        if metadata:
            payload["metadata"] = metadata

        raw_bytes = json.dumps(payload).encode("utf-8")
        ciphertext = self._cipher.encrypt(nonce, raw_bytes, None)

        return {
            "encrypted": True,
            "algorithm": "AES-256-GCM",
            "model": model_name,
            "version": version,
            "dim": dim,
            "nonce": base64.b64encode(nonce).decode("utf-8"),
            "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
            "enrolled_at": payload["enrolled_at"],
        }

    def decrypt(self, data: Any) -> Optional[List[float]]:
        """
        Decrypt a biometric template from database representation.
        Handles:
          1. Encrypted dictionary (AES-256-GCM)
          2. Plain dictionary with 'embedding' key
          3. Legacy unencrypted list of floats [0.123, -0.456, ...]
        Returns the raw float list in memory, or None if invalid.
        """
        if data is None:
            return None

        # Case 1: Legacy raw list
        if isinstance(data, list):
            return [float(v) for v in data]

        # Case 2: Dict format
        if isinstance(data, dict):
            if data.get("encrypted") is True:
                try:
                    nonce = base64.b64decode(data["nonce"])
                    ciphertext = base64.b64decode(data["ciphertext"])
                    plaintext = self._cipher.decrypt(nonce, ciphertext, None)
                    payload = json.loads(plaintext.decode("utf-8"))
                    return [float(v) for v in payload.get("embedding", [])]
                except Exception as exc:
                    logger.error("Failed to decrypt biometric template: %s", exc)
                    return None
            elif "embedding" in data and isinstance(data["embedding"], list):
                return [float(v) for v in data["embedding"]]

        return None

    def get_template_metadata(self, data: Any) -> Dict[str, Any]:
        """Inspect biometric template metadata without exposing raw embeddings."""
        if not data:
            return {"is_enrolled": False}

        if isinstance(data, list):
            return {
                "is_enrolled": True,
                "encrypted": False,
                "dim": len(data),
                "model": "legacy-face-api" if len(data) == 128 else "arcface-512d",
            }

        if isinstance(data, dict):
            if data.get("encrypted"):
                return {
                    "is_enrolled": True,
                    "encrypted": True,
                    "algorithm": data.get("algorithm", "AES-256-GCM"),
                    "model": data.get("model", "facenox-arcface-512d"),
                    "version": data.get("version", "1.0"),
                    "dim": data.get("dim", 512),
                    "enrolled_at": data.get("enrolled_at"),
                }
            elif "embedding" in data:
                emb = data["embedding"]
                return {
                    "is_enrolled": True,
                    "encrypted": False,
                    "dim": len(emb) if isinstance(emb, list) else 0,
                    "model": data.get("model", "unknown"),
                }

        return {"is_enrolled": False}

# Global Singleton Biometric Vault
biometric_vault = BiometricVault()
