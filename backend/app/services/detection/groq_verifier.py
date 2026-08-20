"""
AI Surveillance System - Groq Vision Secondary Verifier

Performs secondary semantic verification on confirmed security events.
Only invoked when an event triggers or on-demand, NEVER on every frame.
"""

import base64
import logging
import re
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class GroqEventVerifier:
    """
    Secondary AI intelligence verification layer.
    Enriches confirmed security events with multimodal LLM reasoning.
    """

    @staticmethod
    async def verify_event_snapshot(
        image_path: str,
        detected_label: str,
        confidence: float,
        groq_api_key: Optional[str] = None
    ) -> Optional[str]:
        """
        Send the evidence snapshot to Groq Vision for semantic analysis.
        Returns a concise verification description or None on failure.
        """
        api_key = groq_api_key or settings.GROQ_API_KEY
        if not api_key:
            logger.debug("No Groq API key available for secondary verification.")
            return None

        # Resolve path
        clean_path = image_path.lstrip("/")
        p = Path(clean_path)
        if not p.exists():
            p = Path("backend") / clean_path
            if not p.exists():
                logger.warning(f"Evidence file not found for Groq verification: {image_path}")
                return None

        try:
            with open(p, "rb") as f:
                img_bytes = f.read()
            b64_image = f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode('utf-8')}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "qwen/qwen3.6-27b",
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are a surveillance AI verifier. Briefly describe the primary subject/action "
                                    "in 1-2 sentences. Verify if the detected object is genuine."
                                )
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"A surveillance camera flagged a '{detected_label}' ({int(confidence*100)}% match). Describe the scene and verify."
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": b64_image}
                                    }
                                ]
                            }
                        ],
                        "temperature": 0.1,
                        "max_tokens": 120
                    }
                )

                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    # Strip think tags if present
                    clean = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                    logger.info(f"Groq verification completed: {clean[:80]}...")
                    return clean
                else:
                    logger.warning(f"Groq API returned status {resp.status_code}: {resp.text}")
                    return None

        except Exception as e:
            logger.error(f"Groq secondary verification error: {e}")
            return None


groq_verifier = GroqEventVerifier()
