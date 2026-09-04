"""Unified embedding provider supporting both local models and OpenAI embeddings."""

import logging
from typing import Optional

from app.core.config import settings
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)


class EmbeddingProvider:
    """Configurable embedding provider (local sentence-transformers or OpenAI API)."""

    def __init__(self) -> None:
        self.provider = settings.EMBEDDING_PROVIDER.lower()
        self._local_service: Optional[EmbeddingService] = None
        self._openai_client = None

    def _get_local(self) -> EmbeddingService:
        if self._local_service is None:
            self._local_service = EmbeddingService()
        return self._local_service

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding vector for a string."""
        if self.provider == "openai":
            try:
                client = get_openai_client()
                return client.create_embedding(text)
            except Exception as e:
                logger.warning(f"OpenAI embedding failed, falling back to local model: {e}")
                return self._get_local().embed_text(text)
        else:
            return self._get_local().embed_text(text)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of strings."""
        if not texts:
            return []
        if self.provider == "openai":
            return [self.embed_text(t) for t in texts]
        else:
            return self._get_local().embed_batch(texts)

    def get_dimension(self) -> int:
        """Returns embedding vector dimension."""
        if self.provider == "openai":
            return 1536
        return settings.EMBEDDING_DIMENSION  # 1024 for BGE-M3
