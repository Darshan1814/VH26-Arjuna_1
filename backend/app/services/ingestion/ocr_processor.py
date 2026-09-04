"""OCR processor for scanned PDF pages using Tesseract.

Falls back to OCR when PyMuPDF detects a page is image-based
(few text characters but has embedded images).

The architecture allows swapping in PaddleOCR or another engine
by implementing the same interface.
"""

import logging
from io import BytesIO

import fitz  # PyMuPDF
from PIL import Image

logger = logging.getLogger(__name__)


class OCRProcessor:
    """Extract text from scanned pages using Tesseract OCR."""

    def __init__(self) -> None:
        self._tesseract_available: bool | None = None

    def _check_tesseract(self) -> bool:
        """Check if Tesseract is available."""
        if self._tesseract_available is not None:
            return self._tesseract_available

        try:
            import pytesseract

            pytesseract.get_tesseract_version()
            self._tesseract_available = True
            logger.info("Tesseract OCR is available")
        except Exception:
            self._tesseract_available = False
            logger.warning(
                "Tesseract OCR is not available. "
                "Scanned pages will have empty text."
            )

        return self._tesseract_available

    def extract_text_from_page(self, page: fitz.Page, dpi: int = 300) -> str:
        """Run OCR on a single PDF page.

        Renders the page to an image at the specified DPI,
        then runs Tesseract OCR on it.

        Args:
            page: A PyMuPDF page object.
            dpi: Resolution for rendering. Higher = better quality but slower.

        Returns:
            Extracted text string, or empty string if OCR fails.
        """
        if not self._check_tesseract():
            return ""

        try:
            import pytesseract

            # Render page to image
            zoom = dpi / 72  # 72 is the default PDF DPI
            matrix = fitz.Matrix(zoom, zoom)
            pixmap = page.get_pixmap(matrix=matrix)

            # Convert to PIL Image
            img = Image.open(BytesIO(pixmap.tobytes("png")))

            # Run OCR
            text = pytesseract.image_to_string(img, lang="eng")
            logger.debug(f"OCR extracted {len(text)} characters from page")

            return text.strip()

        except Exception as e:
            logger.error(f"OCR failed for page: {e}")
            return ""
