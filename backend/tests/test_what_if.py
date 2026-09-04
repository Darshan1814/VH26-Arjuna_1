"""Automated test suite for Evidence-Based What-If Analysis.

Covers all 10 test requirements:
- TEST 1: "What if I continue running the machine?"
- TEST 2: "What if I clean the ventilation?"
- TEST 3: "What if the cooling fan is working?"
- TEST 4: "What if this solution doesn't work?"
- TEST 5: "Which is better: cleaning ventilation or replacing the fan?"
- TEST 6: "What if I skip the recommended step?"
- TEST 7: What-If query with insufficient documentation
- TEST 8: What-If query using previous conversation context
- TEST 9: What-If query with machine-specific context
- TEST 10: Verify citations remain attached to claims without invented page numbers
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.schemas.query import RAGQueryRequest
from app.schemas.rag_response import Citation, RAGResponse, WhatIfAnalysis
from app.services.retrieval.hybrid_retriever import RetrievedChunk
from app.services.what_if.analyzer import WhatIfAnalyzer
from app.services.what_if.state_tracker import TroubleshootingStateTracker
from app.services.what_if.service import WhatIfService
from app.rag.pipeline import RAGPipeline


@pytest.fixture
def sample_chunks():
    """Sample retrieved chunks from machine service manuals."""
    return [
        RetrievedChunk(
            id="chunk-x100-001",
            content=(
                "CNC-X100 Maintenance Manual: Error E101 indicates excessive motor temperature. "
                "Continued operation under excessive temperature will trigger an automatic protective shutdown. "
                "Primary causes include restricted ventilation airflow, clogged air filters, cooling fan failure, "
                "or excessive mechanical load. Technicians must inspect ventilation paths prior to replacing components."
            ),
            page_number=42,
            section="Troubleshooting & Error Codes",
            chunk_index=1,
            error_codes=["E101"],
            manual_id="man-x100",
            machine_id="mach-x100",
            manual_title="CNC-X100 Maintenance Manual",
            machine_model="CNC-X100",
            similarity_score=0.88,
            metadata={"heading": "Motor Overheating Diagnostics", "pdf_page": 44},
        ),
        RetrievedChunk(
            id="chunk-x100-002",
            content=(
                "Corrective action: Clean ventilation intake grills and verify unrestricted airflow. "
                "If ventilation is verified clear and E101 persists, check the cooling fan electrical connections "
                "and test motor rotational load."
            ),
            page_number=43,
            section="Corrective Procedures",
            chunk_index=2,
            error_codes=["E101"],
            manual_id="man-x100",
            machine_id="mach-x100",
            manual_title="CNC-X100 Maintenance Manual",
            machine_model="CNC-X100",
            similarity_score=0.79,
            metadata={"heading": "Ventilation Cleaning", "pdf_page": 45},
        ),
    ]


@pytest.fixture
def mock_what_if_service(sample_chunks):
    """What-If service configured with mock retriever and reranker."""
    retriever = MagicMock()
    retriever.retrieve = AsyncMock(return_value=sample_chunks)

    reranker = MagicMock()
    reranker.rerank = MagicMock(return_value=sample_chunks)

    service = WhatIfService(
        retriever=retriever,
        reranker=reranker,
    )
    return service


# =============================================================================
# TEST 1: "What if I continue running the machine?"
# =============================================================================
@pytest.mark.anyio
async def test_what_if_continue_running(mock_what_if_service):
    """Verify analysis for continuing operation under error/overheating."""
    request = RAGQueryRequest(query="What if I continue running the machine?")
    history = [
        {"role": "user", "content": "CNC-X100 is showing error E101 with high temperature."},
        {"role": "assistant", "content": "E101 indicates motor overheating."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    assert response.what_if_analysis is not None
    assert response.what_if_analysis.scenario_type == "continue_operation"

    # Outcome separation: Documented facts vs Reasoned Inferences vs Unknowns
    assert len(response.what_if_analysis.documented_facts) > 0
    assert any("protective shutdown" in f.lower() for f in response.what_if_analysis.documented_facts)
    assert len(response.what_if_analysis.reasoned_inferences) > 0
    assert len(response.what_if_analysis.unknowns) > 0
    assert any("does not specify" in u.lower() for u in response.what_if_analysis.unknowns)

    # Safety warning
    assert response.what_if_analysis.safety_warning is not None
    assert "safety procedure" in response.what_if_analysis.safety_warning.lower()

    # Timeline progression
    assert len(response.what_if_analysis.timeline) >= 3
    assert "CURRENT" in response.what_if_analysis.timeline[0]

    # Grounded Markdown format
    assert "### 🔮 What-If Analysis" in response.answer
    assert "📘 **Manual Evidence**" in response.answer
    assert "🧠 **Reasoned Inference**" in response.answer
    assert "❓ **Unknown**" in response.answer


# =============================================================================
# TEST 2: "What if I clean the ventilation?"
# =============================================================================
@pytest.mark.anyio
async def test_what_if_clean_ventilation(mock_what_if_service):
    """Verify evaluation of a proposed fix action."""
    request = RAGQueryRequest(query="What if I clean the ventilation?")
    history = [
        {"role": "user", "content": "CNC-X100 is throwing E101 overheating."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    assert response.what_if_analysis.scenario_type == "test_fix"
    assert "Clean the ventilation" in response.what_if_analysis.hypothetical_action

    # Grounded effect & rationale
    assert any("airflow" in f.lower() or "ventilation" in f.lower() for f in response.what_if_analysis.documented_facts)
    assert any("address" in inf.lower() or "overheating" in inf.lower() for inf in response.what_if_analysis.reasoned_inferences)

    # Verification / After Action step present
    assert response.what_if_analysis.recommended_action is not None
    assert "recheck" in response.what_if_analysis.recommended_action.lower() or "monitor" in response.what_if_analysis.recommended_action.lower()


# =============================================================================
# TEST 3: "What if the cooling fan is working?"
# =============================================================================
@pytest.mark.anyio
async def test_what_if_fan_is_working(mock_what_if_service):
    """Verify branching logic when a component check is verified working."""
    request = RAGQueryRequest(query="What if the cooling fan is working?")
    history = [
        {"role": "user", "content": "Machine X100 has error E101."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    assert response.what_if_analysis.scenario_type == "branching"

    # Branching reprioritization
    facts_and_inferences = " ".join(response.what_if_analysis.documented_facts + response.what_if_analysis.reasoned_inferences).lower()
    assert "fan" in facts_and_inferences
    assert "ventilation" in facts_and_inferences or "load" in facts_and_inferences
    assert any("BRANCH" in step for step in response.what_if_analysis.timeline)


# =============================================================================
# TEST 4: "What if this solution doesn't work?"
# =============================================================================
@pytest.mark.anyio
async def test_what_if_solution_does_not_work(mock_what_if_service):
    """Verify subsequent troubleshooting recommendations when a fix fails."""
    request = RAGQueryRequest(query="What if cleaning the ventilation doesn't fix it?")
    history = [
        {"role": "user", "content": "X100 E101 motor overheating."},
        {"role": "assistant", "content": "Step 1: Clean ventilation intake."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    assert response.what_if_analysis.scenario_type == "fix_failed"

    # Retrieves next documented steps
    doc_text = " ".join(response.what_if_analysis.documented_facts).lower()
    assert "cooling fan" in doc_text or "motor load" in doc_text or "persists" in doc_text
    assert response.what_if_analysis.recommended_action is not None


# =============================================================================
# TEST 5: "Which is better: cleaning ventilation or replacing the fan?"
# =============================================================================
@pytest.mark.anyio
async def test_action_comparison(mock_what_if_service):
    """Verify structured action comparison between maintenance and part replacement."""
    request = RAGQueryRequest(query="Which is better: cleaning ventilation or replacing the fan?")
    history = [
        {"role": "user", "content": "CNC-X100 error E101."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    assert response.what_if_analysis.scenario_type == "action_comparison"
    assert len(response.what_if_analysis.comparison_table) >= 2

    actions = [item.action.lower() for item in response.what_if_analysis.comparison_table]
    assert any("ventilation" in a for a in actions)
    assert any("fan" in a for a in actions)

    # Explanation of which to check first
    all_inferences = " ".join(response.what_if_analysis.reasoned_inferences).lower()
    assert "first" in all_inferences or "lower intervention" in all_inferences


# =============================================================================
# TEST 6: "What if I skip the recommended step?"
# =============================================================================
@pytest.mark.anyio
async def test_what_if_skip_step(mock_what_if_service):
    """Verify warning when attempting to skip diagnostic steps."""
    request = RAGQueryRequest(query="What if I skip the recommended step?")
    history = [
        {"role": "user", "content": "X100 E101 overheating."},
        {"role": "assistant", "content": "Follow the safety cooling step."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    assert response.what_if_analysis.scenario_type == "skip_step"
    assert any("sequentially" in f.lower() or "safety" in f.lower() for f in response.what_if_analysis.documented_facts)
    assert "do not skip" in response.what_if_analysis.recommended_action.lower()


# =============================================================================
# TEST 7: What-If query with insufficient documentation
# =============================================================================
@pytest.mark.anyio
async def test_insufficient_documentation():
    """Verify exact insufficient evidence handling without hallucinations."""
    retriever = MagicMock()
    retriever.retrieve = AsyncMock(return_value=[])  # No chunks found

    reranker = MagicMock()
    reranker.rerank = MagicMock(return_value=[])

    service = WhatIfService(retriever=retriever, reranker=reranker)
    request = RAGQueryRequest(query="What if I modify the custom hydraulic valve?")

    response = await service.process_what_if(request)

    assert response.is_what_if is True
    assert response.is_insufficient is True
    assert "Insufficient information in the available manuals to reliably evaluate this scenario." in response.answer
    assert response.confidence == 0.0


# =============================================================================
# TEST 8: What-If query using previous conversation context
# =============================================================================
@pytest.mark.anyio
async def test_context_resolution_for_anaphora(mock_what_if_service):
    """Verify that 'it' is resolved to Machine X100 and E101 from earlier turns."""
    request = RAGQueryRequest(query="What if I continue running it?")
    history = [
        {"role": "user", "content": "Machine X100 is showing E101."},
        {"role": "assistant", "content": "E101 indicates excessive motor temperature."},
    ]

    response = await mock_what_if_service.process_what_if(request, conversation_history=history)

    assert response.is_what_if is True
    # Machine resolved
    assert response.detected_machine == "X100" or "X100" in response.what_if_analysis.current_situation.get("machine", "")
    # Error code resolved
    assert response.detected_error_code == "E101" or response.what_if_analysis.current_situation.get("error_code") == "E101"
    # Never treated as unknown object
    assert "it" not in response.what_if_analysis.current_situation.get("machine", "").lower()


# =============================================================================
# TEST 9: What-If query with machine-specific context
# =============================================================================
@pytest.mark.anyio
async def test_machine_specific_context(mock_what_if_service):
    """Verify that specific machine ID and model are preserved during analysis."""
    request = RAGQueryRequest(
        query="What if I replace the cooling fan on PRESS-Z200?",
        machine_id="mach-press-z200",
    )

    response = await mock_what_if_service.process_what_if(request)

    assert response.is_what_if is True
    assert "Z200" in (response.detected_machine or "") or response.what_if_analysis.current_situation.get("machine") == "PRESS-Z200"


# =============================================================================
# TEST 10: Verify citations remain attached to claims without invented pages
# =============================================================================
@pytest.mark.anyio
async def test_citations_preserved_without_invented_pages(mock_what_if_service):
    """Verify citation accuracy, page formatting, and chunk tracking."""
    request = RAGQueryRequest(query="What if I clean the ventilation?")
    response = await mock_what_if_service.process_what_if(request)

    assert len(response.citations) > 0
    top_citation = response.citations[0]

    assert top_citation.manual == "CNC-X100 Maintenance Manual"
    assert top_citation.section == "Troubleshooting & Error Codes"
    assert top_citation.page == 42
    assert top_citation.chunk_id == "chunk-x100-001"

    # Verify citation formatting string
    from app.services.citations.citation_builder import CitationBuilder
    formatted = CitationBuilder.format_citation_string(top_citation)
    assert formatted in response.answer

    # Test chunk with no page number does NOT invent one
    no_page_chunk = RetrievedChunk(
        id="chunk-no-page-12345678",
        content="General service safety instructions.",
        page_number=0,  # Missing / unpaginated
        section="Safety Procedures",
        chunk_index=0,
        error_codes=[],
        manual_id="man-nopage",
        machine_id="mach-1",
        manual_title="Safety Manual",
        similarity_score=0.8,
        metadata={"pdf_page": 5},
    )

    service = WhatIfService(
        retriever=MagicMock(retrieve=AsyncMock(return_value=[no_page_chunk])),
        reranker=MagicMock(rerank=MagicMock(return_value=[no_page_chunk])),
    )
    resp = await service.process_what_if(request)
    cit = resp.citations[0]

    assert cit.page is None  # Never invented
    assert cit.pdf_page == 5
    assert "PDF Page 5" in resp.answer
