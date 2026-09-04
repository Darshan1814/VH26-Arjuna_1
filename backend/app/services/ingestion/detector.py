"""File type and natural language detection."""

import mimetypes
import os
from typing import Tuple

try:
    from langdetect import detect
except ImportError:
    detect = lambda text: "en"  # Fallback if langdetect unavailable


def detect_file_type(filename: str, file_bytes: bytes) -> str:
    """Classify input into a normalized source type: pdf, image, csv, log, docx, or text."""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == ".pdf":
        return "pdf"
    if ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"):
        return "image"
    if ext == ".csv":
        return "csv"
    if ext in (".log", ".out"):
        return "log"
    if ext in (".docx", ".doc"):
        return "docx"
    if ext in (".txt", ".md", ".json"):
        return "text"

    # Fallback to MIME detection
    mime, _ = mimetypes.guess_type(filename)
    if mime:
        if "pdf" in mime:
            return "pdf"
        if "image" in mime:
            return "image"
        if "csv" in mime:
            return "csv"
        if "word" in mime:
            return "docx"

    # Inspect first few bytes
    if file_bytes.startswith(b"%PDF"):
        return "pdf"
    if file_bytes[:8] in (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff"):
        return "image"

    return "text"


def detect_language(text: str) -> str:
    """Detect natural language of text content."""
    clean_sample = " ".join(text.split()[:50])
    if not clean_sample.strip() or len(clean_sample) < 10:
        return "en"
    try:
        lang = detect(clean_sample)
        return lang or "en"
    except Exception:
        return "en"


class DetectionResult:
    """Container for detected file type and language."""
    def __init__(self, detected_type: str, language: str = "en"):
        self.detected_type = detected_type
        self.language = language


class IngestionDetector:
    """Class wrapper for multi-format file type and language detection."""
    def detect(self, file_bytes: bytes, filename: str) -> DetectionResult:
        file_type = detect_file_type(filename, file_bytes)
        try:
            text_snippet = file_bytes[:1000].decode("utf-8", errors="ignore")
            lang = detect_language(text_snippet)
        except Exception:
            lang = "en"
        return DetectionResult(detected_type=file_type, language=lang)

