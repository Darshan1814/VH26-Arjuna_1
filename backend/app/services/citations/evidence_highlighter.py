"""Renders genuine manual page screenshots with yellow evidence highlights."""

import os
import logging
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image, ImageDraw

from app.core.config import settings

logger = logging.getLogger(__name__)


class EvidenceHighlighter:
    """Extracts and highlights genuine evidence pages from source documents."""

    @staticmethod
    def highlight_pdf_page(
        pdf_path: str,
        page_number: int,
        search_terms: list[str],
        output_name: str,
    ) -> Optional[str]:
        """Render a specific PDF page with yellow highlighted search terms."""
        if not os.path.exists(pdf_path):
            logger.warning(f"PDF manual not found on disk at: {pdf_path}")
            return None

        try:
            doc = fitz.open(pdf_path)
            if page_number < 1 or page_number > len(doc):
                logger.warning(f"Page {page_number} out of range (total {len(doc)})")
                return None

            page = doc.load_page(page_number - 1)

            # Search and highlight evidence terms in yellow
            found_any = False
            for term in search_terms:
                if not term or len(term.strip()) < 3:
                    continue
                quads = page.search_for(term)
                for quad in quads:
                    annot = page.add_highlight_annot(quad)
                    annot.set_colors(stroke=(1.0, 1.0, 0.0))  # Bright yellow
                    annot.update()
                    found_any = True

            # If specific term not found, search first words of first term
            if not found_any and search_terms:
                sample_words = " ".join(search_terms[0].split()[:3])
                quads = page.search_for(sample_words)
                for quad in quads:
                    annot = page.add_highlight_annot(quad)
                    annot.set_colors(stroke=(1.0, 1.0, 0.0))
                    annot.update()

            pix = page.get_pixmap(dpi=150)
            os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
            output_file = os.path.join(settings.EVIDENCE_DIR, output_name)
            pix.save(output_file)
            doc.close()
            return output_file
        except Exception as e:
            logger.error(f"Failed to generate highlighted evidence page: {e}")
            return None

    @staticmethod
    def highlight_image(
        image_path: str,
        output_name: str,
    ) -> Optional[str]:
        """Add subtle yellow evidence highlight border to an image/screenshot."""
        if not os.path.exists(image_path):
            return None
        try:
            img = Image.open(image_path).convert("RGB")
            draw = ImageDraw.Draw(img)
            w, h = img.size
            # Draw yellow evidence border
            draw.rectangle([4, 4, w - 4, h - 4], outline=(255, 220, 0), width=6)
            os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
            output_file = os.path.join(settings.EVIDENCE_DIR, output_name)
            img.save(output_file)
            return output_file
        except Exception as e:
            logger.error(f"Failed to highlight image: {e}")
            return None
