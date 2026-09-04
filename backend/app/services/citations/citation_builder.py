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
        to avoid redundant source references.

        Args:
            chunks: The reranked chunks used to generate the answer.

        Returns:
            List of unique Citation objects.
        """
        seen: set[str] = set()
        citations: list[Citation] = []

        for chunk in chunks:
            # Create a deduplication key
            key = f"{chunk.manual_id}:{chunk.section}:{chunk.page_number}"

            if key in seen:
                continue
            seen.add(key)

            citation = Citation(
                manual=chunk.manual_title or chunk.manual_id,
                machine_model=chunk.machine_model or chunk.machine_id,
                section=chunk.section,
                page=chunk.page_number,
                chunk_id=chunk.id,
                relevance_score=round(chunk.similarity_score, 4),
            )
            citations.append(citation)

        logger.info(f"Built {len(citations)} unique citations from {len(chunks)} chunks")
        return citations
