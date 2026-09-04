"""Tesseract OCR integration for scanned documents and images."""

import io
import logging
from typing import Optional

from PIL import Image

try:
    import pytesseract
except ImportError:
    pytesseract = None

logger = logging.getLogger(__name__)


class OCRProcessor:
    """Extracts text from images and low-density scanned PDF pages using Tesseract."""

    @staticmethod
    def extract_text_from_image(image_bytes: bytes) -> str:
        """Run OCR on image bytes."""
        if pytesseract is None:
            logger.warning("pytesseract is not available.")
            return ""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Convert to grayscale / RGB if necessary
            if image.mode not in ("L", "RGB"):
                image = image.convert("RGB")
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return ""
