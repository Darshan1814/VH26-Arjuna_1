"""Structured RAG response schema with ranked solutions, citations, and evidence."""

from typing import Any, Optional
from pydantic import BaseModel


class Citation(BaseModel):
    """A single source citation from the retrieved documents."""

    manual: str
    machine_model: str
    section: Optional[str] = None
    page: Optional[int] = None
    chunk_id: Optional[str] = None
    relevance_score: Optional[float] = None
    source_type: Optional[str] = "pdf"
    file_name: Optional[str] = None
    evidence_image_url: Optional[str] = None


class RecommendedSolution(BaseModel):
    """Prioritized technical recommendation with supporting evidence."""

    priority: int = 1
    action: str
    reason: str
    evidence_strength: str = "Strong"
    source: str = "Manual Excerpt"
    is_verified: bool = True


class RAGResponse(BaseModel):
    """Full structured response from the industrial RAG pipeline."""

    problem: Optional[str] = None
    diagnosis: Optional[str] = None
    answer: str
    probable_causes: list[str] = []
    corrective_steps: list[str] = []
    recommended_solutions: list[RecommendedSolution] = []
    safety_warnings: list[str] = []

    # Confidence scoring
    confidence: float = 0.0
    confidence_level: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    confidence_reasons: list[str] = []

    # Traceable citations
    citations: list[Citation] = []
    proof_links: list[dict[str, Any]] = []
    evidence_images: list[dict[str, Any]] = []

    # State flags for the frontend
    is_ambiguous: bool = False
    ambiguity_message: Optional[str] = None
    ambiguous_machines: list[str] = []

    is_insufficient: bool = False
    insufficient_message: Optional[str] = None

    # Query metadata
    detected_error_code: Optional[str] = None
    detected_machine: Optional[str] = None
    query_type: Optional[str] = None

    # Conversation context & reporting
    conversation_id: Optional[str] = None
    report_id: Optional[str] = None
    report_pdf_url: Optional[str] = None
    report_html_url: Optional[str] = None
