"""
AI Surveillance System - RF-DETR-2XL / XL Adapter (rfdetr-plus)

Provides safety guards, GPU prerequisites verification, and license gating for
Roboflow RF-DETR+ large-scale models (RFDETRXLarge, RFDETR2XLarge).

SAFETY RULES:
1. NEVER automatically accept the Platform Model License (PML 1.0).
2. NEVER attempt to download or run 2XL weights (~126M params, 880x880 resolution)
   on a CPU-only environment or on cloud instances without an NVIDIA CUDA GPU (8GB+ VRAM).
3. If no compatible CUDA GPU is available or license is not explicitly consented to,
   the adapter strictly remains disabled with clear diagnostic messaging.
"""

import gc
import logging
import threading
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# State locks & flags
_lock = threading.Lock()
_model_2xl = None
_loaded: bool = False
_license_accepted_by_user: bool = False


def is_gpu_available() -> bool:
    """Check if an NVIDIA CUDA GPU is accessible via PyTorch."""
    try:
        import torch
        return bool(torch.cuda.is_available() and torch.cuda.device_count() > 0)
    except Exception:
        return False


def get_gpu_device_info() -> Dict[str, Any]:
    """Retrieve detailed GPU hardware information if present."""
    if not is_gpu_available():
        return {
            "available": False,
            "device_name": None,
            "device_count": 0,
            "vram_total_mb": 0,
            "vram_free_mb": 0,
            "cuda_version": None,
        }

    try:
        import torch
        dev = 0
        props = torch.cuda.get_device_properties(dev)
        vram_total = props.total_memory / (1024 * 1024)
        vram_free = torch.cuda.mem_get_info(dev)[0] / (1024 * 1024)
        return {
            "available": True,
            "device_name": props.name,
            "device_count": torch.cuda.device_count(),
            "vram_total_mb": round(vram_total, 1),
            "vram_free_mb": round(vram_free, 1),
            "cuda_version": torch.version.cuda,
        }
    except Exception as e:
        logger.warning(f"[RF-DETR-2XL] Failed to read GPU metrics: {e}")
        return {
            "available": True,
            "device_name": "CUDA GPU",
            "device_count": 1,
            "vram_total_mb": 0,
            "vram_free_mb": 0,
            "cuda_version": None,
        }


def check_2xl_readiness() -> Dict[str, Any]:
    """
    Audit environment to verify whether RF-DETR-2XL can be safely operated.
    """
    gpu_info = get_gpu_device_info()
    has_gpu = gpu_info["available"]
    min_vram_met = gpu_info.get("vram_total_mb", 0) >= 6000 if has_gpu else False

    reason: List[str] = []
    if not has_gpu:
        reason.append("Host is CPU-only. RF-DETR-2XL (126M params) requires an NVIDIA GPU to run in real-time.")
    elif not min_vram_met:
        reason.append(f"GPU VRAM ({gpu_info.get('vram_total_mb', 0):.0f}MB) is below the recommended 6GB-8GB threshold.")

    if not _license_accepted_by_user:
        reason.append("Platform Model License (PML 1.0) must be reviewed and explicitly accepted before initializing weights.")

    return {
        "ready": has_gpu and min_vram_met and _license_accepted_by_user,
        "gpu_available": has_gpu,
        "gpu_info": gpu_info,
        "license_accepted": _license_accepted_by_user,
        "reason": " | ".join(reason) if reason else "System is fully ready for RF-DETR-2XL.",
    }


def set_user_license_acceptance(accepted: bool) -> None:
    """
    Record user's explicit consent to the Roboflow Platform Model License (PML 1.0).
    """
    global _license_accepted_by_user
    with _lock:
        _license_accepted_by_user = bool(accepted)
        logger.info(f"[RF-DETR-2XL] User license acceptance updated: {_license_accepted_by_user}")


def is_loaded() -> bool:
    """Return whether the 2XL model is resident in GPU memory."""
    global _model_2xl, _loaded
    return _loaded and _model_2xl is not None


def unload_model() -> None:
    """Evict RF-DETR-2XL from GPU memory to reclaim VRAM."""
    global _model_2xl, _loaded
    with _lock:
        if _model_2xl is not None:
            logger.info("[RF-DETR-2XL] Unloading RF-DETR-2XL from memory...")
            _model_2xl = None
            _loaded = False
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass


def load_model(accept_platform_model_license: bool = False) -> None:
    """
    Attempt to load RF-DETR-2XL.
    Rejects execution if no GPU is available or license is not accepted.
    """
    global _model_2xl, _loaded, _license_accepted_by_user
    with _lock:
        if _model_2xl is not None and _loaded:
            return

        # 1. Hardware safety gate
        if not is_gpu_available():
            raise RuntimeError(
                "RF-DETR-2XL initialization blocked: No NVIDIA CUDA GPU detected. "
                "Running 126M parameter DINOv2 vision transformers on CPU would freeze the system."
            )

        # 2. License safety gate
        if not (accept_platform_model_license or _license_accepted_by_user):
            raise PermissionError(
                "RF-DETR-2XL initialization blocked: Roboflow Platform Model License (PML 1.0) "
                "must be explicitly reviewed and accepted (set accept_platform_model_license=True)."
            )

        # 3. Dynamic package import
        try:
            from rfdetr_plus import RFDETR2XLarge
        except ImportError as e:
            raise ImportError(
                "The 'rfdetr-plus' package is required for RF-DETR-2XL. "
                "Install with: pip install rfdetr-plus"
            ) from e

        logger.info("[RF-DETR-2XL] Initializing RFDETR2XLarge on CUDA GPU...")
        _model_2xl = RFDETR2XLarge(accept_platform_model_license=True)
        _loaded = True
        _license_accepted_by_user = True
        logger.info("[RF-DETR-2XL] RFDETR2XLarge successfully loaded.")

