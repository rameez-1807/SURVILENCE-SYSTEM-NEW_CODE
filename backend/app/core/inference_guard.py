"""Guard memory-heavy AI inference on memory-constrained cloud hosts.

Render's free 512 MiB instances cannot reliably load a PyTorch/YOLO model.
Keep REST APIs and database features available instead of allowing an OOM
kill of the entire web service. On an appropriately sized host, explicitly
set ENABLE_SERVER_AI_INFERENCE=true to enable server-side models.
"""

import os


AI_INFERENCE_DISABLED_MESSAGE = (
    "Server-side YOLO/ANPR inference is disabled on this low-memory host "
    "to prevent the API server from crashing. The dashboard and database "
    "APIs remain available. Use a larger server or run inference locally, "
    "then set ENABLE_SERVER_AI_INFERENCE=true."
)


def server_ai_inference_enabled() -> bool:
    """Local installs default to enabled; Render defaults to safe API-only mode."""
    configured = os.environ.get("ENABLE_SERVER_AI_INFERENCE")
    if configured is not None:
        return configured.strip().lower() in {"1", "true", "yes", "on"}
    return not bool(os.environ.get("RENDER") or os.environ.get("RENDER_SERVICE_ID"))
