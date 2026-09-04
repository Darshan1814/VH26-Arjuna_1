"""BGE reranker for improving retrieval precision.

Uses BAAI/bge-reranker-v2-m3 to rerank retrieved chunks by relevance
to the original query. The reranker provides a more accurate relevance
score than the initial vector similarity.
"""

import logging
from typing import Optional

from app.core.config import settings
from app.services.retrieval.hybrid_retriever import RetrievedChunk

logger = logging.getLogger(__name__)


class Reranker:
    """Rerank retrieved chunks using a cross-encoder model."""

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name = model_name or settings.RERANKER_MODEL
        self._model = None

    @property
    def model(self):
        """Lazy-load the reranker model."""
        if self._model is None:
            logger.info(f"Loading reranker model: {self.model_name}")
            from sentence_transformers import CrossEncoder

            self._model = CrossEncoder(
                self.model_name,
                max_length=512,
                cache_folder=settings.HF_HOME,
            )
            logger.info("Reranker model loaded")
        return self._model

    def rerank(
        self,
        query: str,
        chunks: list[RetrievedChunk],
        top_k: int = 5,
    ) -> list[RetrievedChunk]:
        """Rerank chunks by relevance to the query.

        Args:
            query: The original user query.
            chunks: Retrieved chunks to rerank.
            top_k: Number of top results to return.

        Returns:
            Reranked list of chunks with updated similarity scores.
        """
        if not chunks:
            return []

        if len(chunks) <= 1:
            return chunks

        # Prepare query-document pairs for the cross-encoder
        pairs = [[query, chunk.content] for chunk in chunks]

        # Score all pairs
        scores = self.model.predict(pairs, show_progress_bar=False)

        # Update chunk scores and sort
        for chunk, score in zip(chunks, scores):
            chunk.similarity_score = float(score)

        # Sort by reranker score descending
        reranked = sorted(chunks, key=lambda c: c.similarity_score, reverse=True)

        logger.info(
            f"Reranked {len(chunks)} chunks. "
            f"Top score: {reranked[0].similarity_score:.4f}, "
            f"Bottom score: {reranked[-1].similarity_score:.4f}"
        )

        return reranked[:top_k]
