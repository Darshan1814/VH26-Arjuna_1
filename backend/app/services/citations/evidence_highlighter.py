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
        """Render a specific PDF page with yellow highlighted points and search terms."""
        if not os.path.exists(pdf_path):
            logger.warning(f"PDF manual not found on disk at: {pdf_path}")
            return None

        try:
            doc = fitz.open(pdf_path)
            if page_number < 1 or page_number > len(doc):
                logger.warning(f"Page {page_number} out of range (total {len(doc)})")
                return None

            page = doc.load_page(page_number - 1)

            # Build comprehensive list of target terms (error codes, words, phrases)
            terms_to_search: list[str] = []
            for term in search_terms:
                if not term or not term.strip():
                    continue
                clean = term.strip()
                terms_to_search.append(clean)
                # If term has multiple words, also search individual keywords (>= 4 chars)
                words = [w.strip(".,;:\"'()[]{}") for w in clean.split() if len(w.strip()) >= 4]
                terms_to_search.extend(words)

            # Deduplicate keeping order
            unique_terms = []
            for t in terms_to_search:
                if t and t.lower() not in [x.lower() for x in unique_terms]:
                    unique_terms.append(t)

            # Search and apply high-visibility yellow highlight annotations
            highlight_count = 0
            for term in unique_terms:
                try:
                    quads = page.search_for(term)
                    for quad in quads:
                        annot = page.add_highlight_annot(quad)
                        annot.set_colors(stroke=(1.0, 0.95, 0.0))  # Vivid Yellow
                        annot.update()
                        highlight_count += 1
                        if highlight_count >= 25:  # Avoid cluttering
                            break
                except Exception:
                    continue
                if highlight_count >= 25:
                    break

            # Render page at 150 DPI for crystal-clear readability
            pix = page.get_pixmap(dpi=150)
            os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
            output_file = os.path.join(settings.EVIDENCE_DIR, output_name)
            pix.save(output_file)

            # Add subtle prominent boundary highlight to guarantee screen visibility
            try:
                with Image.open(output_file) as img:
                    img = img.convert("RGB")
                    draw = ImageDraw.Draw(img)
                    w, h = img.size
                    draw.rectangle([0, 0, w - 1, h - 1], outline=(234, 179, 8), width=4)
                    img.save(output_file)
            except Exception as border_err:
                logger.debug(f"Evidence border overlay optional note: {border_err}")

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
