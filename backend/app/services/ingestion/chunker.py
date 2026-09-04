"""Document chunking with metadata extraction.

Splits extracted document text into overlapping chunks while preserving:
- Section context
- Page numbers
- Error code annotations
- Machine/manual metadata
"""

import logging
import re
from dataclasses import dataclass, field

from app.services.ingestion.pdf_processor import ExtractedDocument, ExtractedPage

logger = logging.getLogger(__name__)

# Regex to detect error codes like E101, ERR-42, F001, A1234
ERROR_CODE_PATTERN = re.compile(
    r"\b([A-Z]{1,3}[-_]?\d{2,5})\b"
)


@dataclass
class DocumentChunk:
    """A single chunk of document text with full metadata."""

    content: str
    page_number: int
    section: str
    chunk_index: int
    content_type: str  # "text", "table", "heading"
    error_codes: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


class DocumentChunker:
    """Split documents into chunks suitable for embedding and retrieval."""

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        min_chunk_size: int = 50,
    ) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size

    def chunk_document(
        self,
        document: ExtractedDocument,
        machine_id: str,
        manual_id: str,
    ) -> list[DocumentChunk]:
        """Split an extracted document into chunks with metadata.

        Args:
            document: The extracted document from PDFProcessor.
            machine_id: ID of the machine this manual belongs to.
            manual_id: ID of the manual record.

        Returns:
            List of DocumentChunk objects ready for embedding.
        """
        all_chunks: list[DocumentChunk] = []
        chunk_index = 0

        for page in document.pages:
            if not page.text.strip():
                continue

            current_section = self._get_current_section(page)
            page_chunks = self._split_text(page.text)

            for chunk_text in page_chunks:
                if len(chunk_text.strip()) < self.min_chunk_size:
                    continue

                # Detect error codes in this chunk
                error_codes = self._extract_error_codes(chunk_text)

                chunk = DocumentChunk(
                    content=chunk_text.strip(),
                    page_number=page.page_number,
                    section=current_section,
                    chunk_index=chunk_index,
                    content_type="text",
                    error_codes=error_codes,
                    metadata={
                        "machine_id": machine_id,
                        "manual_id": manual_id,
                        "filename": document.filename,
                        "is_scanned": page.is_scanned,
                    },
                )
                all_chunks.append(chunk)
                chunk_index += 1

        logger.info(
            f"Chunked {document.filename}: "
            f"{len(all_chunks)} chunks from {document.total_pages} pages"
        )

        return all_chunks

    def _split_text(self, text: str) -> list[str]:
        """Split text into overlapping chunks, respecting sentence boundaries."""
        # Split on paragraph boundaries first, then recombine to target size
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        chunks: list[str] = []
        current_chunk: list[str] = []
        current_length = 0

        for paragraph in paragraphs:
            para_len = len(paragraph)

            if current_length + para_len > self.chunk_size and current_chunk:
                # Save current chunk
                chunks.append("\n\n".join(current_chunk))

                # Keep overlap: take the last paragraph(s) for overlap
                overlap_text = current_chunk[-1] if current_chunk else ""
                if len(overlap_text) <= self.chunk_overlap:
                    current_chunk = [overlap_text]
                    current_length = len(overlap_text)
                else:
                    current_chunk = []
                    current_length = 0

            current_chunk.append(paragraph)
            current_length += para_len

        # Don't forget the last chunk
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks

    def _get_current_section(self, page: ExtractedPage) -> str:
        """Get the most recent section heading for a page."""
        if page.sections:
            return page.sections[0]
        return "General"

    def _extract_error_codes(self, text: str) -> list[str]:
        """Extract error codes from text using regex."""
        matches = ERROR_CODE_PATTERN.findall(text)
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for code in matches:
            if code not in seen:
                seen.add(code)
                unique.append(code)
        return unique
