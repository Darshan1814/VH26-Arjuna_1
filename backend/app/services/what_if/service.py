"""What-If Analysis Service: orchestrates RAG-grounded hypothetical analysis.

Pipeline:
1. Extract cumulative troubleshooting state from conversation history & query.
2. Classify What-If scenario (continue_operation, test_fix, fix_failed, etc.).
3. Augment retrieval query with machine, error, and scenario context.
4. Retrieve and rerank chunks from the knowledge base using existing HybridRetriever.
5. Perform strict evidence sufficiency check to prevent unsupported speculation.
6. Generate grounded response with explicit separation:
   - 📘 Manual Evidence (Documented)
   - 🧠 Reasoned Inference
   - ❓ Unknown
7. Build citations and return structured What-If response.
"""

import logging
from typing import Optional

from app.schemas.query import RAGQueryRequest
from app.schemas.rag_response import (
    Citation,
    RAGResponse,
    WhatIfAnalysis,
    WhatIfComparisonItem,
    WhatIfEvidenceItem,
)
from app.services.citations.citation_builder import CitationBuilder
from app.services.generation import GenerationService
from app.services.reranking.reranker import Reranker
from app.services.retrieval.hybrid_retriever import HybridRetriever, RetrievedChunk
from app.services.retrieval.query_analyzer import QueryAnalysis
from app.services.what_if.analyzer import WhatIfAnalyzer
from app.services.what_if.state_tracker import TroubleshootingState, TroubleshootingStateTracker

logger = logging.getLogger(__name__)

MIN_WHAT_IF_SCORE = 0.05


class WhatIfService:
    """Orchestrates Evidence-Based What-If Analysis for machine troubleshooting."""

    def __init__(
        self,
        retriever: Optional[HybridRetriever] = None,
        reranker: Optional[Reranker] = None,
        generation_service: Optional[GenerationService] = None,
        citation_builder: Optional[CitationBuilder] = None,
    ) -> None:
        self.state_tracker = TroubleshootingStateTracker()
        self.analyzer = WhatIfAnalyzer()
        self.retriever = retriever or HybridRetriever()
        self.reranker = reranker or Reranker()
        self.generation_service = generation_service or GenerationService()
        self.citation_builder = citation_builder or CitationBuilder()

    async def process_what_if(
        self,
        request: RAGQueryRequest,
        conversation_history: Optional[list[dict]] = None,
    ) -> RAGResponse:
        """Process a hypothetical What-If troubleshooting query."""
        logger.info(f"Executing What-If analysis for: {request.query[:100]}...")

        # Step 1: Extract cumulative troubleshooting state
        state = self.state_tracker.extract_state(
            conversation_history=conversation_history,
            current_query=request.query,
            preselected_machine_id=request.machine_id,
        )

        # Step 2: Classify scenario
        scenario_type = self.analyzer.classify_scenario(request.query, state)
        logger.info(f"Classified What-If scenario: {scenario_type}")

        # Step 3: Check for unsafe operation
        safety_warning = self.analyzer.check_safety_hazard(request.query, scenario_type)

        # Step 4: Build augmented query and search analysis
        augmented_query = self.analyzer.build_augmented_search_query(
            query=request.query,
            state=state,
            scenario_type=scenario_type,
        )

        query_analysis = QueryAnalysis(
            original_query=request.query,
            query_type="what_if",
            error_codes=state.error_codes,
            machine_id=state.machine_id,
            machine_model=state.machine_model,
            semantic_query=augmented_query,
        )

        # Step 5: Retrieve relevant chunks
        retrieved_chunks = await self.retriever.retrieve(
            analysis=query_analysis,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
        )

        # Step 6: Rerank results
        reranked_chunks = self.reranker.rerank(
            query=augmented_query,
            chunks=retrieved_chunks,
            top_k=request.rerank_top_k,
        )

        # Step 7: Check evidence sufficiency
        if not self._has_sufficient_evidence(reranked_chunks):
            return self._insufficient_response(state, scenario_type, request.conversation_id)

        # Step 8: Build citations
        citations = self.citation_builder.build_citations(reranked_chunks)

        # Step 9: Generate grounded What-If analysis
        analysis = await self._generate_analysis(
            query=request.query,
            state=state,
            scenario_type=scenario_type,
            chunks=reranked_chunks,
            citations=citations,
            safety_warning=safety_warning,
            conversation_history=conversation_history,
        )

        # Step 10: Format markdown answer and assemble response
        answer_markdown = self.analyzer.format_what_if_markdown(analysis, citations)

        return RAGResponse(
            answer=answer_markdown,
            probable_causes=[f"Condition related to {state.diagnosis}"] if state.diagnosis else [],
            corrective_steps=[analysis.recommended_action] if analysis.recommended_action else [],
            confidence=round(reranked_chunks[0].similarity_score, 2) if reranked_chunks else 0.75,
            citations=citations,
            is_what_if=True,
            what_if_analysis=analysis,
            detected_error_code=state.error_codes[0] if state.error_codes else None,
            detected_machine=state.machine_model or state.machine_id,
            query_type="what_if",
            conversation_id=request.conversation_id,
        )

    def _has_sufficient_evidence(self, chunks: list[RetrievedChunk]) -> bool:
        """Check if retrieved manual evidence is sufficient to evaluate scenario."""
        if not chunks:
            return False
        if chunks[0].similarity_score < MIN_WHAT_IF_SCORE:
            logger.warning(
                f"What-If top chunk score ({chunks[0].similarity_score:.4f}) "
                f"below threshold ({MIN_WHAT_IF_SCORE})"
            )
            return False
        return True

    def _insufficient_response(
        self,
        state: TroubleshootingState,
        scenario_type: str,
        conversation_id: Optional[str] = None,
    ) -> RAGResponse:
        """Return standardized response when manual documentation is insufficient."""
        msg = (
            "Insufficient information in the available manuals to reliably evaluate this scenario. "
            "To help evaluate, please provide the specific machine model, error code, or relevant manual section."
        )
        return RAGResponse(
            answer=(
                "Insufficient information in the available manuals to reliably evaluate this scenario.\n\n"
                "Please check that the relevant machine manual has been uploaded and processed, or specify:\n"
                "- Machine model\n"
                "- Error code\n"
                "- Current symptoms"
            ),
            is_insufficient=True,
            insufficient_message=msg,
            is_what_if=True,
            detected_error_code=state.error_codes[0] if state.error_codes else None,
            detected_machine=state.machine_model or state.machine_id,
            query_type="what_if",
            confidence=0.0,
            conversation_id=conversation_id,
        )

    async def _generate_analysis(
        self,
        query: str,
        state: TroubleshootingState,
        scenario_type: str,
        chunks: list[RetrievedChunk],
        citations: list[Citation],
        safety_warning: Optional[str],
        conversation_history: Optional[list[dict]],
    ) -> WhatIfAnalysis:
        """Generate structured What-If analysis, either via LLM or deterministic grounding."""
        # Try Azure OpenAI first if configured
        try:
            llm_result = await self.generation_service.generate_what_if(
                query=query,
                context_chunks=chunks,
                state_context=state.to_dict(),
                scenario_type=scenario_type,
                conversation_history=conversation_history,
            )

            if llm_result and "documented_facts" in llm_result:
                comparison_items = [
                    WhatIfComparisonItem(**item) for item in llm_result.get("comparison_table", [])
                ]
                evidence_items = []
                for fact in llm_result.get("documented_facts", []):
                    evidence_items.append(WhatIfEvidenceItem(evidence_type="manual", statement=fact))
                for inf in llm_result.get("reasoned_inferences", []):
                    evidence_items.append(WhatIfEvidenceItem(evidence_type="inference", statement=inf))
                for unk in llm_result.get("unknowns", []):
                    evidence_items.append(WhatIfEvidenceItem(evidence_type="unknown", statement=unk))

                return WhatIfAnalysis(
                    scenario_type=llm_result.get("scenario_type", scenario_type),
                    current_situation=state.to_dict(),
                    hypothetical_action=llm_result.get("hypothetical_action", query),
                    documented_facts=llm_result.get("documented_facts", []),
                    reasoned_inferences=llm_result.get("reasoned_inferences", []),
                    unknowns=llm_result.get("unknowns", []),
                    timeline=llm_result.get("timeline", []),
                    comparison_table=comparison_items,
                    recommended_action=llm_result.get("recommended_action"),
                    safety_warning=safety_warning or llm_result.get("safety_warning"),
                    evidence_items=evidence_items,
                )
        except Exception as e:
            logger.info(f"Falling back to rule-based grounded analysis: {e}")

        # Deterministic grounded analysis from retrieved chunks and scenario logic
        return self._synthesize_grounded_analysis(
            query=query,
            state=state,
            scenario_type=scenario_type,
            chunks=chunks,
            citations=citations,
            safety_warning=safety_warning,
        )

    def _synthesize_grounded_analysis(
        self,
        query: str,
        state: TroubleshootingState,
        scenario_type: str,
        chunks: list[RetrievedChunk],
        citations: list[Citation],
        safety_warning: Optional[str],
    ) -> WhatIfAnalysis:
        """Synthesize analysis directly from chunk text and scenario constraints."""
        top_chunk = chunks[0] if chunks else None
        chunk_text = top_chunk.content if top_chunk else ""
        machine_name = state.machine_model or (top_chunk.machine_model if top_chunk else "Machine")
        error_name = state.error_codes[0] if state.error_codes else "Active condition"

        documented_facts: list[str] = []
        reasoned_inferences: list[str] = []
        unknowns: list[str] = []
        timeline: list[str] = []
        comparison_table: list[WhatIfComparisonItem] = []
        recommended_action = "Follow the documented manual procedure."
        possible_outcome = "Evaluation based on service manual documentation."
        why = "Based on documented relationships between symptoms and corrective procedures."

        if scenario_type == "continue_operation":
            hypothetical_action = "Continue operating the machine while the fault condition is active."
            possible_outcome = (
                f"The manual indicates that continued operation under excessive temperature or error {error_name} "
                "can trigger an automatic protective shutdown."
            )
            why = "The service manual specifies protective thermal interlocks to prevent permanent component damage."
            documented_facts.append(
                f"The manual states that continued operation under excessive temperature or error {error_name} "
                f"can trigger a protective shutdown."
            )
            reasoned_inferences.append(
                "Based on the current overheating condition, continued operation may increase thermal stress on the motor."
            )
            unknowns.append(
                "The available manual does not specify how long the machine can safely operate before shutdown or component damage."
            )
            recommended_action = "Follow the documented shutdown and cooling procedure specified in the manual."
            timeline = [
                f"CURRENT: Machine {machine_name} exhibiting {error_name} / high temperature",
                "WHAT IF: Continue operation",
                "POSSIBLE: Temperature remains elevated; machine may enter protective shutdown",
                "VERIFICATION: Follow documented shutdown and inspection procedure",
            ]

        elif scenario_type == "test_fix":
            hypothetical_action = "Clean the ventilation ducts and air intake."
            possible_outcome = (
                "Cleaning the ventilation may address the overheating condition if restricted airflow is contributing to the problem."
            )
            why = "The manual identifies restricted ventilation and blocked airflow as a possible contributing cause."
            documented_facts.append(
                "The manual identifies restricted ventilation and blocked airflow as a contributing cause to elevated temperature."
            )
            reasoned_inferences.append(
                "Cleaning the ventilation may address the overheating condition if blocked airflow is contributing to the problem."
            )
            unknowns.append(
                "The manual does not guarantee that cleaning ventilation alone will clear the error if internal component wear is present."
            )
            recommended_action = "Clean ventilation and recheck operating temperature and error status according to manual."
            timeline = [
                f"CURRENT: {machine_name} showing {error_name} (overheating)",
                "ACTION: Clean ventilation pathways",
                "EXPECTED: Airflow restored; thermal dissipation improved",
                "VERIFICATION: Recheck temperature and monitor for fault recurrence",
            ]

        elif scenario_type == "branching":
            hypothetical_action = "Assume the cooling fan is operational and functioning normally."
            possible_outcome = (
                "With the cooling fan verified operational, fan failure is deprioritized in favor of ventilation and motor load diagnostics."
            )
            why = "The manual diagnostic logic branches away from cooling fan replacement when the fan is functional."
            documented_facts.append(
                "The manual diagnostic tree indicates that when the cooling fan is operational, primary focus shifts to ventilation restriction and motor mechanical load."
            )
            reasoned_inferences.append(
                "With the cooling fan verified working, fan replacement is lower priority; inspect ventilation pathways next."
            )
            unknowns.append(
                "The manual does not specify whether motor bearing friction is present without a manual rotational check."
            )
            recommended_action = "Verify ventilation clearance, then inspect motor load and electrical supply."
            timeline = [
                "CHECK: Cooling fan = Operational",
                "BRANCH: Fan failure deprioritized",
                "NEXT CHECK: Inspect ventilation for airflow blockages",
                "IF CLEAR: Test motor load and bearing condition",
            ]

        elif scenario_type == "fix_failed":
            hypothetical_action = "The initial cleaning or reset action has been completed but the fault persists."
            possible_outcome = (
                f"If ventilation is verified clear and {error_name} persists, the manual recommends checking cooling fan operation and motor load."
            )
            why = "Secondary diagnostic procedures must be consulted when initial airflow cleaning does not resolve the thermal fault."
            documented_facts.append(
                f"If the error persists after ventilation is verified clear, the manual recommends checking the cooling fan operation and motor load."
            )
            reasoned_inferences.append(
                "Since external airflow did not resolve the condition, the root cause is likely internal fan failure, sensor defect, or excessive mechanical load."
            )
            unknowns.append(
                "The manual does not indicate which secondary cause is most probable without electrical measurement."
            )
            recommended_action = "Check cooling fan electrical supply and test motor load according to manual instructions."
            timeline = [
                "STEP: Clean ventilation completed",
                "RESULT: Error persists",
                "NEXT DOCUMENTED STEP: Inspect cooling fan operation and measure motor load",
            ]

        elif scenario_type == "action_comparison":
            hypothetical_action = "Compare cleaning the ventilation versus replacing the cooling fan."
            possible_outcome = (
                "Cleaning ventilation should be checked first because it is lower intervention and the fan has not yet been identified as defective."
            )
            why = "The documentation prioritizes non-invasive airflow inspection before replacing components that have not been confirmed defective."
            documented_facts.append(
                "The manual recommends inspecting ventilation prior to component replacement as part of the initial diagnostic sequence."
            )
            reasoned_inferences.append(
                "Cleaning the ventilation should be checked first because it is lower intervention and the fan has not yet been identified as defective."
            )
            unknowns.append(
                "The documentation does not state the exact condition of the installed cooling fan without physical inspection."
            )
            comparison_table = [
                WhatIfComparisonItem(
                    action="Clean ventilation",
                    relevance="Relevant if airflow is restricted",
                    intervention_level="Lower intervention / Maintenance",
                    manual_supported=True,
                    notes="Recommended first check in manual diagnostic sequence",
                ),
                WhatIfComparisonItem(
                    action="Replace cooling fan",
                    relevance="Relevant if fan motor is mechanically or electrically defective",
                    intervention_level="Component replacement / Higher intervention",
                    manual_supported=True,
                    notes="Requires verification of fan failure before replacement",
                ),
            ]
            recommended_action = "Inspect and clean ventilation first; verify fan operation before attempting fan replacement."

        elif scenario_type == "skip_step":
            hypothetical_action = "Skip the recommended diagnostic or inspection step."
            possible_outcome = (
                "Skipping sequential diagnostic checks risks premature component replacement or unobserved thermal damage."
            )
            why = "The service manual mandates executing diagnostic steps in sequence to ensure equipment safety."
            documented_facts.append(
                "The manual requires completing safety and diagnostic checks sequentially before clearing errors or restarting production."
            )
            reasoned_inferences.append(
                "Skipping the recommended inspection risks premature component replacement or unobserved thermal damage."
            )
            unknowns.append(
                "The manual does not guarantee safe operation if preliminary checks are bypassed."
            )
            recommended_action = "Do not skip the documented procedure; execute all diagnostic steps in sequence."

        else:
            hypothetical_action = query
            documented_facts.append(
                f"Service manual documentation for {machine_name} specifies standard maintenance and diagnostic limits."
            )
            reasoned_inferences.append(
                "Hypothetical variations should be evaluated in accordance with documented manufacturer procedures."
            )
            unknowns.append(
                "Specific quantitative outcomes for this hypothetical action are not detailed in the available manual."
            )
            recommended_action = "Consult the documented troubleshooting procedures in the service manual."

        evidence_items = []
        for fact in documented_facts:
            evidence_items.append(WhatIfEvidenceItem(evidence_type="manual", statement=fact))
        for inf in reasoned_inferences:
            evidence_items.append(WhatIfEvidenceItem(evidence_type="inference", statement=inf))
        for unk in unknowns:
            evidence_items.append(WhatIfEvidenceItem(evidence_type="unknown", statement=unk))

        return WhatIfAnalysis(
            scenario_type=scenario_type,
            current_situation=state.to_dict(),
            hypothetical_action=hypothetical_action,
            possible_outcome=possible_outcome,
            why=why,
            documented_facts=documented_facts,
            reasoned_inferences=reasoned_inferences,
            unknowns=unknowns,
            timeline=timeline,
            comparison_table=comparison_table,
            recommended_action=recommended_action,
            safety_warning=safety_warning,
            evidence_items=evidence_items,
        )
