"""Citation builder: construct source citations from retrieved chunks.

Maps each retrieved chunk back to its manual, section, and page
to provide traceable evidence for every answer.
"""

import logging

from app.schemas.rag_response import Citation
from app.services.retrieval.hybrid_retriever import RetrievedChunk

logger = logging.getLogger(__name__)


class CitationBuilder:
    """Build structured citations from retrieved document chunks."""

    def build_citations(self, chunks: list[RetrievedChunk]) -> list[Citation]:
        """Create citation objects from retrieved chunks.

        Deduplicates citations that point to the same manual+page+section
        to avoid redundant source references. Never invents page numbers.

        Args:
            chunks: The reranked chunks used to generate the answer.

        Returns:
            List of unique Citation objects.
        """
        seen: set[str] = set()
        citations: list[Citation] = []

        for chunk in chunks:
            # Metadata extraction
            metadata = chunk.metadata or {}
            heading = metadata.get("heading") or None
            pdf_page = metadata.get("pdf_page") or None

            # Only consider valid positive page numbers as printed page numbers
            page = chunk.page_number if chunk.page_number and chunk.page_number > 0 else None

            # Create a deduplication key
            key = f"{chunk.manual_id}:{chunk.section}:{heading}:{page}:{pdf_page}:{chunk.id}"

            if key in seen:
                continue
            seen.add(key)

            citation = Citation(
                manual=chunk.manual_title or chunk.manual_id,
                machine_model=chunk.machine_model or chunk.machine_id,
                section=chunk.section or "General",
                heading=heading,
                page=page,
                pdf_page=pdf_page,
                chunk_id=chunk.id,
                relevance_score=round(chunk.similarity_score, 4) if chunk.similarity_score else None,
            )
            citations.append(citation)

        logger.info(f"Built {len(citations)} unique citations from {len(chunks)} chunks")
        return citations

    @staticmethod
    def format_citation_string(citation: Citation) -> str:
        """Format citation cleanly without hallucinating page numbers.

        Follows Section 13 rules:
        - If printed page: Manual → Section [→ Heading] → Page X
        - If no printed page but PDF page: Manual → Section [→ Heading] → PDF Page Y
        - If no page info: Manual → Section [→ Heading] (Chunk: Z)
        """
        parts = [citation.manual]
        if citation.section and citation.section != "General":
            parts.append(citation.section)
        if citation.heading:
            parts.append(citation.heading)

        if citation.page is not None and citation.page > 0:
            parts.append(f"Page {citation.page}")
        elif citation.pdf_page is not None and citation.pdf_page > 0:
            parts.append(f"PDF Page {citation.pdf_page}")
        elif citation.chunk_id:
            parts.append(f"Chunk ID {citation.chunk_id[:8]}")

        return " → ".join(parts)
