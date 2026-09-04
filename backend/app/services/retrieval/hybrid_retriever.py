"""Hybrid retrieval: vector search + exact error code match + metadata filtering.

Combines multiple retrieval strategies to find the most relevant chunks:
1. Exact error code matching (highest priority)
2. Vector similarity search via pgvector
3. Metadata filtering (machine_id, manual_id)

Results are merged and deduplicated before reranking.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.retrieval.query_analyzer import QueryAnalysis

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    """A document chunk retrieved from the database with relevance metadata."""

    id: str
    content: str
    page_number: int
    section: str
    chunk_index: int
    error_codes: list[str]
    manual_id: str
    machine_id: str
    manual_title: str = ""
    machine_model: str = ""
    similarity_score: float = 0.0
    match_type: str = "vector"  # "exact_error", "vector", "keyword"
    metadata: dict = field(default_factory=dict)


class HybridRetriever:
    """Retrieve relevant document chunks using multiple strategies."""

    def __init__(self, embedding_service: Optional[EmbeddingService] = None) -> None:
        self._embedding_service = embedding_service

    @property
    def embedding_service(self) -> EmbeddingService:
        if self._embedding_service is None:
            self._embedding_service = EmbeddingService()
        return self._embedding_service

    async def retrieve(
        self,
        analysis: QueryAnalysis,
        top_k: int = 10,
        similarity_threshold: float = 0.3,
    ) -> list[RetrievedChunk]:
        """Execute hybrid retrieval based on query analysis.

        Args:
            analysis: The analyzed query with error codes and machine info.
            top_k: Maximum number of chunks to return.
            similarity_threshold: Minimum similarity score for vector results.

        Returns:
            List of RetrievedChunk objects, sorted by relevance.
        """
        all_chunks: list[RetrievedChunk] = []

        # Strategy 1: Exact error code matching
        if analysis.error_codes:
            exact_chunks = await self._exact_error_search(
                error_codes=analysis.error_codes,
                machine_id=analysis.machine_id,
            )
            all_chunks.extend(exact_chunks)
            logger.info(f"Exact error search found {len(exact_chunks)} chunks")

        # Strategy 2: Vector similarity search
        vector_chunks = await self._vector_search(
            query=analysis.semantic_query,
            machine_id=analysis.machine_id,
            top_k=top_k,
            threshold=similarity_threshold,
        )
        all_chunks.extend(vector_chunks)
        logger.info(f"Vector search found {len(vector_chunks)} chunks")

        # Deduplicate by chunk ID, keeping highest-scoring version
        deduped = self._deduplicate(all_chunks)

        # Sort: exact matches first, then by similarity score
        deduped.sort(
            key=lambda c: (
                0 if c.match_type == "exact_error" else 1,
                -c.similarity_score,
            )
        )

        return deduped[:top_k]

    async def _exact_error_search(
        self,
        error_codes: list[str],
        machine_id: Optional[str] = None,
    ) -> list[RetrievedChunk]:
        """Find chunks containing specific error codes."""
        try:
            client = get_supabase_client()
            query = (
                client.table("document_chunks")
                .select(
                    "id, content, page_number, section, chunk_index, "
                    "error_codes, manual_id, machine_id, metadata"
                )
                .overlaps("error_codes", error_codes)
            )

            if machine_id:
                query = query.eq("machine_id", machine_id)

            result = query.limit(20).execute()

            chunks = []
            for row in result.data:
                chunks.append(
                    RetrievedChunk(
                        id=row["id"],
                        content=row["content"],
                        page_number=row["page_number"],
                        section=row.get("section", ""),
                        chunk_index=row.get("chunk_index", 0),
                        error_codes=row.get("error_codes", []),
                        manual_id=row["manual_id"],
                        machine_id=row["machine_id"],
                        similarity_score=1.0,  # Exact match gets highest score
                        match_type="exact_error",
                        metadata=row.get("metadata", {}),
                    )
                )

            return chunks

        except Exception as e:
            logger.error(f"Exact error search failed: {e}")
            return []

    async def _vector_search(
        self,
        query: str,
        machine_id: Optional[str] = None,
        top_k: int = 10,
        threshold: float = 0.3,
    ) -> list[RetrievedChunk]:
        """Perform vector similarity search using pgvector.

        Uses the match_document_chunks Supabase function which runs
        cosine similarity via pgvector.
        """
        try:
            # Generate query embedding
            query_embedding = self.embedding_service.embed_text(query)

            client = get_supabase_client()

            # Call the Supabase RPC function for similarity search
            params = {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "similarity_threshold": threshold,
            }

            if machine_id:
                params["filter_machine_id"] = machine_id

            result = client.rpc("match_document_chunks", params).execute()

            chunks = []
            for row in result.data:
                chunks.append(
                    RetrievedChunk(
                        id=row["id"],
                        content=row["content"],
                        page_number=row["page_number"],
                        section=row.get("section", ""),
                        chunk_index=row.get("chunk_index", 0),
                        error_codes=row.get("error_codes", []),
                        manual_id=row["manual_id"],
                        machine_id=row["machine_id"],
                        similarity_score=row.get("similarity", 0.0),
                        match_type="vector",
                        metadata=row.get("metadata", {}),
                    )
                )

            return chunks

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    def _deduplicate(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Remove duplicate chunks, keeping the highest-scoring version."""
        seen: dict[str, RetrievedChunk] = {}
        for chunk in chunks:
            if chunk.id not in seen or chunk.similarity_score > seen[chunk.id].similarity_score:
                seen[chunk.id] = chunk
        return list(seen.values())
