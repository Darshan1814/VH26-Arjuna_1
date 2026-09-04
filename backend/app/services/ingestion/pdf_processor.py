"""PDF text and layout extraction using PyMuPDF.

Extracts text from PDF pages, detects structure (headings, sections),
and falls back to OCR for scanned/image-heavy pages.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


@dataclass
class ExtractedPage:
    """Represents extracted content from a single PDF page."""

    page_number: int
    text: str
    is_scanned: bool = False
    has_images: bool = False
    sections: list[str] = field(default_factory=list)


@dataclass
class ExtractedDocument:
    """Full extraction result from a PDF document."""

    filename: str
    total_pages: int
    pages: list[ExtractedPage]
    metadata: dict = field(default_factory=dict)


class PDFProcessor:
    """Extract text and structure from PDF documents using PyMuPDF."""

    # If a page has less than this many characters, it might be scanned
    SCANNED_PAGE_THRESHOLD = 50

    def extract(self, pdf_path: str | Path) -> ExtractedDocument:
        """Extract text and metadata from a PDF file.

        Args:
            pdf_path: Path to the PDF file.

        Returns:
            ExtractedDocument with text and metadata for each page.
        """
        pdf_path = Path(pdf_path)
        logger.info(f"Processing PDF: {pdf_path.name}")

        doc = fitz.open(str(pdf_path))
        pages: list[ExtractedPage] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            has_images = len(page.get_images()) > 0
            is_scanned = len(text.strip()) < self.SCANNED_PAGE_THRESHOLD and has_images

            # Detect section headings (text blocks with larger font sizes)
            sections = self._detect_sections(page)

            pages.append(
                ExtractedPage(
                    page_number=page_num + 1,  # 1-indexed
                    text=text,
                    is_scanned=is_scanned,
                    has_images=has_images,
                    sections=sections,
                )
            )

        metadata = {
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "page_count": len(doc),
        }

        doc.close()

        logger.info(
            f"Extracted {len(pages)} pages from {pdf_path.name} "
            f"({sum(1 for p in pages if p.is_scanned)} scanned pages detected)"
        )

        return ExtractedDocument(
            filename=pdf_path.name,
            total_pages=len(pages),
            pages=pages,
            metadata=metadata,
        )

    def _detect_sections(self, page: fitz.Page) -> list[str]:
        """Detect section headings from a page by analyzing font sizes.

        Blocks with notably larger font sizes are likely headings.
        """
        sections: list[str] = []
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

        for block in blocks.get("blocks", []):
            if block.get("type") != 0:  # text block
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    # Heuristic: font size > 13pt is likely a heading
                    if span.get("size", 0) > 13 and span.get("text", "").strip():
                        sections.append(span["text"].strip())

        return sections

    def extract_from_bytes(self, content: bytes, filename: str) -> ExtractedDocument:
        """Extract from raw PDF bytes (for uploaded files)."""
        logger.info(f"Processing PDF from bytes: {filename}")

        doc = fitz.open(stream=content, filetype="pdf")
        pages: list[ExtractedPage] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            has_images = len(page.get_images()) > 0
            is_scanned = len(text.strip()) < self.SCANNED_PAGE_THRESHOLD and has_images
            sections = self._detect_sections(page)

            pages.append(
                ExtractedPage(
                    page_number=page_num + 1,
                    text=text,
                    is_scanned=is_scanned,
                    has_images=has_images,
                    sections=sections,
                )
            )

        metadata = {
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "page_count": len(doc),
        }

        doc.close()

        return ExtractedDocument(
            filename=filename,
            total_pages=len(pages),
            pages=pages,
            metadata=metadata,
        )
