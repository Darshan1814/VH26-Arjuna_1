"""RAG query request schema."""

from typing import Optional

from pydantic import BaseModel


class RAGQueryRequest(BaseModel):
    """Request payload for the RAG query endpoint."""

    query: str
    machine_id: Optional[str] = None
    conversation_id: Optional[str] = None

    # Optional overrides for retrieval tuning
    top_k: int = 10
    rerank_top_k: int = 5
    similarity_threshold: float = 0.3
