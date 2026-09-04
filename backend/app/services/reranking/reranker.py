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
        """Lazy-load the reranker model with error resilience."""
        if self._model is None:
            try:
                logger.info(f"Loading reranker model: {self.model_name}")
                from sentence_transformers import CrossEncoder

                self._model = CrossEncoder(
                    self.model_name,
                    max_length=512,
                )
                logger.info("Reranker model loaded successfully")
            except Exception as e:
                logger.warning(f"Could not load CrossEncoder model '{self.model_name}': {e}. Using fallback ranker.")
                self._model = False
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

        # Attempt neural CrossEncoder scoring if model is available
        model = self.model
        if model:
            try:
                pairs = [[query, chunk.content] for chunk in chunks]
                scores = model.predict(pairs, show_progress_bar=False)
                for chunk, score in zip(chunks, scores):
                    chunk.similarity_score = float(score)
                reranked = sorted(chunks, key=lambda c: c.similarity_score, reverse=True)
                return reranked[:top_k]
            except Exception as predict_err:
                logger.warning(f"CrossEncoder prediction failed: {predict_err}. Using lexical relevance fallback.")

        # Fallback scoring: BM25 / token overlap + original similarity
        q_tokens = set(query.lower().split())
        for chunk in chunks:
            c_tokens = set(chunk.content.lower().split())
            overlap = len(q_tokens.intersection(c_tokens)) / max(len(q_tokens), 1)
            # Boost chunks that have exact matching phrases or error codes
            exact_bonus = 0.2 if any(e.lower() in query.lower() for e in chunk.error_codes) else 0.0
            chunk.similarity_score = max(chunk.similarity_score, round(0.5 + 0.4 * overlap + exact_bonus, 4))

        reranked = sorted(chunks, key=lambda c: c.similarity_score, reverse=True)
        return reranked[:top_k]
