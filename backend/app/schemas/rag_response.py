"""Structured RAG response schema with citations, confidence, and ambiguity state."""

from typing import Optional

from pydantic import BaseModel


class Citation(BaseModel):
    """A single source citation from the retrieved documents."""

    manual: str
    machine_model: str
    section: Optional[str] = None
    page: Optional[int] = None
    chunk_id: Optional[str] = None
    relevance_score: Optional[float] = None


class RAGResponse(BaseModel):
    """Full structured response from the RAG pipeline."""

    answer: str
    probable_causes: list[str] = []
    corrective_steps: list[str] = []
    confidence: float = 0.0
    citations: list[Citation] = []

    # State flags for the frontend
    is_ambiguous: bool = False
    ambiguity_message: Optional[str] = None
    ambiguous_machines: list[str] = []

    is_insufficient: bool = False
    insufficient_message: Optional[str] = None

    # Query metadata
    detected_error_code: Optional[str] = None
    detected_machine: Optional[str] = None
    query_type: Optional[str] = None  # "error_code", "natural_language", "machine_specific"

    # Conversation context
    conversation_id: Optional[str] = None
