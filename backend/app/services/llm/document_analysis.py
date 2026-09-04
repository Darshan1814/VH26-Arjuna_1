"""Document and image analysis service using OpenAI."""

import base64
import logging
from typing import Any, Optional

from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)


class DocumentAnalysisService:
    """Extracts structured metadata, error codes, and machine info from text/images."""

    def __init__(self) -> None:
        self.client = get_openai_client()

    def analyze_text(self, text: str, file_name: str) -> dict[str, Any]:
        """Extract machine model, error codes, and main topic from text."""
        prompt = f"""Analyze the following technical content from file "{file_name}".
Extract:
1. Machine name / model (e.g. CNC-X100, PRESS-Z200). If none, null.
2. Error codes mentioned (e.g. E101, ERR-42).
3. Main component / section topic (e.g. Spindle System, Hydraulic Unit).
4. Safety warnings detected.

Content excerpt:
{text[:3000]}

Respond ONLY in valid JSON:
{{
  "machine_model": string or null,
  "error_codes": [string],
  "section": string,
  "has_warnings": boolean,
  "summary": string
}}"""
        try:
            return self.client.json_completion([{"role": "user", "content": prompt}])
        except Exception as e:
            logger.warning(f"LLM document analysis failed: {e}")
            return {
                "machine_model": None,
                "error_codes": [],
                "section": "General",
                "has_warnings": False,
                "summary": text[:200],
            }

    def analyze_image_or_screenshot(
        self,
        image_bytes: bytes,
        file_name: str,
        mime_type: str = "image/png",
    ) -> dict[str, Any]:
        """Analyze an image, machine panel, or error screenshot using vision."""
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        prompt = f"""You are an industrial diagnostics expert inspecting image "{file_name}".
Analyze the image and determine:
1. What kind of image is this? (e.g. machine error screenshot, control panel, wiring diagram, physical part, nameplate)
2. Machine model or serial if visible on screen/panel.
3. Any error codes, fault messages, or alarm numbers displayed.
4. Physical symptoms or abnormalities shown (e.g. LED state, smoke, leak, damage).
5. Exact text transcript of alarms or readings.

Respond ONLY in valid JSON:
{{
  "image_type": string,
  "machine_model": string or null,
  "error_codes": [string],
  "symptoms": [string],
  "extracted_text": string,
  "description": string
}}"""
        try:
            raw = self.client.vision_completion(prompt, encoded, mime_type)
            cleaned = self.client._clean_json_text(raw)
            import json
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"Image vision analysis failed: {e}")
            return {
                "image_type": "industrial_image",
                "machine_model": None,
                "error_codes": [],
                "symptoms": [],
                "extracted_text": "",
                "description": f"Image file: {file_name}",
            }
