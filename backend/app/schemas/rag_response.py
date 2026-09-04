"""Structured RAG response schema with citations, confidence, and ambiguity state."""

from typing import Optional, Any

from pydantic import BaseModel


class Citation(BaseModel):
    """A single source citation from the retrieved documents."""

    manual: str
    machine_model: str
    section: Optional[str] = None
    heading: Optional[str] = None
    page: Optional[int] = None
    pdf_page: Optional[int] = None
    chunk_id: Optional[str] = None
    relevance_score: Optional[float] = None


class WhatIfComparisonItem(BaseModel):
    """Item for action comparison table in What-If analysis."""

    action: str
    relevance: str
    intervention_level: str
    manual_supported: bool = True
    notes: Optional[str] = None


class WhatIfEvidenceItem(BaseModel):
    """Single evidence item for the What-If evidence panel."""

    evidence_type: str  # "manual" | "inference" | "unknown"
    statement: str
    citation_ref: Optional[str] = None


class WhatIfAnalysis(BaseModel):
    """Structured What-If scenario analysis details."""

    scenario_type: str = "general"  # continue_operation, test_fix, fix_failed, action_comparison, branching, skip_step, general
    current_situation: dict[str, Any] = {}
    hypothetical_action: str = ""
    possible_outcome: Optional[str] = None
    why: Optional[str] = None
    documented_facts: list[str] = []
    reasoned_inferences: list[str] = []
    unknowns: list[str] = []
    timeline: list[str] = []
    comparison_table: list[WhatIfComparisonItem] = []
    recommended_action: Optional[str] = None
    safety_warning: Optional[str] = None
    evidence_items: list[WhatIfEvidenceItem] = []


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

    # What-If Analysis mode details
    is_what_if: bool = False
    what_if_analysis: Optional[WhatIfAnalysis] = None

    # Query metadata
    detected_error_code: Optional[str] = None
    detected_machine: Optional[str] = None
    query_type: Optional[str] = None  # "error_code", "natural_language", "machine_specific", "what_if"

    # Conversation context
    conversation_id: Optional[str] = None
