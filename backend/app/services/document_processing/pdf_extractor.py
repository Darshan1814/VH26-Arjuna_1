"""PDF document extraction with structure, table, and OCR fallback."""

import logging
from typing import Any

import fitz  # PyMuPDF

from app.services.ocr.tesseract_ocr import OCRProcessor

logger = logging.getLogger(__name__)


class PDFExtractor:
    """Extracts structured text, tables, sections, and images from PDF documents."""

    def __init__(self) -> None:
        self.ocr = OCRProcessor()

    def process_pdf(self, pdf_bytes: bytes, file_name: str) -> dict[str, Any]:
        """Extract pages, sections, tables, and images from a PDF file."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_data = []
        tables_count = 0
        diagrams_count = 0
        ocr_pages_count = 0

        current_section = "General"

        for page_idx in range(total_pages):
            page = doc.load_page(page_idx)
            page_num = page_idx + 1
            text = page.get_text("text").strip()

            # Check for images / diagrams on page
            images = page.get_images()
            if images:
                diagrams_count += len(images)

            # Check for tables using PyMuPDF table finder
            page_tables = []
            try:
                tabs = page.find_tables()
                if tabs.tables:
                    tables_count += len(tabs.tables)
                    for tab in tabs.tables:
                        df_rows = tab.extract()
                        page_tables.append(df_rows)
            except Exception:
                pass

            # Detect headings / section titles from blocks
            blocks = page.get_text("blocks")
            for b in blocks:
                block_text = b[4].strip()
                # If block is short, title-cased or uppercase, treat as potential section heading
                if 4 < len(block_text) < 60 and ("section" in block_text.lower() or block_text.isupper()):
                    current_section = block_text.replace("\n", " ")
                    break

            # Fallback to OCR if text is scarce (< 50 characters) but images exist
            was_ocr = False
            if len(text) < 50 and images:
                pix = page.get_pixmap(dpi=150)
                ocr_text = self.ocr.extract_text_from_image(pix.tobytes())
                if len(ocr_text) > len(text):
                    text = ocr_text
                    was_ocr = True
                    ocr_pages_count += 1

            pages_data.append({
                "page_number": page_num,
                "section": current_section,
                "text": text,
                "has_tables": len(page_tables) > 0,
                "table_data": page_tables,
                "image_count": len(images),
                "was_ocr": was_ocr,
            })

        return {
            "total_pages": total_pages,
            "pages": pages_data,
            "tables_detected": tables_count,
            "diagrams_detected": diagrams_count,
            "ocr_pages_processed": ocr_pages_count,
        }
