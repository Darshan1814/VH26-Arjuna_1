"""Orchestrates the complete industrial RAG troubleshooting pipeline."""

import os
import logging
from typing import Any, Optional

from app.core.config import settings
from app.core.database import get_supabase_client
from app.schemas.query import RAGQueryRequest
from app.schemas.rag_response import RAGResponse, Citation, RecommendedSolution
from app.services.llm.query_analysis import QueryAnalysisService
from app.services.llm.answer_generation import AnswerGenerationService
from app.services.llm.solution_ranker import SolutionRankerService
from app.services.retrieval.hybrid_retriever import HybridRetriever, RetrievedChunk
from app.services.retrieval.query_analyzer import QueryAnalyzer
from app.services.retrieval.confidence_evaluator import ConfidenceEvaluator
from app.services.reranking.reranker import Reranker
from app.services.disambiguation.machine_disambiguator import MachineDisambiguator
from app.services.citations.evidence_highlighter import EvidenceHighlighter

logger = logging.getLogger(__name__)

MIN_EVIDENCE_CHUNKS = 1
MIN_EVIDENCE_SCORE = 0.15


class RAGPipeline:
    """End-to-end industrial troubleshooting RAG pipeline."""

    def __init__(self) -> None:
        self.query_analyzer = QueryAnalyzer()
        self.llm_query_analyzer = QueryAnalysisService()
        self.retriever = HybridRetriever()
        self.disambiguator = MachineDisambiguator()
        self.reranker = Reranker()
        self.confidence_evaluator = ConfidenceEvaluator()
        self.answer_generator = AnswerGenerationService()
        self.solution_ranker = SolutionRankerService()
        self.highlighter = EvidenceHighlighter()

    async def process_query(self, request: RAGQueryRequest) -> RAGResponse:
        """Process troubleshooting question through query understanding, hybrid retrieval,
        disambiguation, reranking, confidence scoring, grounded generation, and citation highlighting."""
        query = request.query.strip()
        logger.info(f"Processing troubleshooting query: '{query[:80]}'...")

        # Step 1: Conversation context
        conversation_history = None
        context_machine = request.machine_id
        if request.conversation_id:
            conversation_history = await self._get_conversation_history(request.conversation_id)
            if not context_machine and conversation_history:
                context_machine = self._extract_machine_from_history(conversation_history)

        # Step 2: Query understanding
        analysis_dict = self.llm_query_analyzer.analyze(
            query=query,
            conversation_context=conversation_history,
            context_machine_id=context_machine,
        )
        heuristic_analysis = self.query_analyzer.analyze(
            query=query,
            machine_id=request.machine_id or context_machine,
        )

        detected_errors = list(set(analysis_dict.get("error_codes", []) + heuristic_analysis.error_codes))
        target_machine = (
            request.machine_id
            or analysis_dict.get("machine_model")
            or heuristic_analysis.machine_model
            or context_machine
        )

        # Step 3: Hybrid retrieval (Exact error code + Keyword + pgvector)
        retrieved_chunks = await self.retriever.retrieve(
            analysis=heuristic_analysis,
            top_k=request.top_k or 10,
            similarity_threshold=request.similarity_threshold or 0.25,
        )

        # Enrich chunks with machine and manual titles
        enriched_chunks = await self._enrich_chunks(retrieved_chunks)
        chunk_dicts = [self._chunk_to_dict(c) for c in enriched_chunks]

        # Step 4: Cross-manual ambiguity check
        disambig = self.disambiguator.check_ambiguity(
            detected_error_codes=detected_errors,
            explicit_machine=target_machine,
            retrieved_chunks=chunk_dicts,
        )

        if disambig.is_ambiguous:
            return RAGResponse(
                problem=f"Ambiguous Error Code: {disambig.error_code}",
                diagnosis="This error code appears in multiple equipment manuals with conflicting meanings.",
                answer=disambig.clarification_message or "Please specify which machine model you are troubleshooting.",
                probable_causes=[],
                corrective_steps=[],
                recommended_solutions=[],
                confidence=0.45,
                confidence_level="MEDIUM",
                confidence_reasons=[
                    f"Cross-manual ambiguity detected: {disambig.error_code} is used by {', '.join(disambig.candidate_machines)}."
                ],
                is_ambiguous=True,
                ambiguity_message=disambig.clarification_message,
                ambiguous_machines=disambig.candidate_machines,
                detected_error_code=disambig.error_code,
                detected_machine=None,
                conversation_id=request.conversation_id,
            )

        # Step 5: Neural cross-encoder reranking
        reranked = self.reranker.rerank(
            query=query,
            chunks=enriched_chunks,
            top_k=request.rerank_top_k or 5,
        )

        top_similarity = retrieved_chunks[0].similarity_score if retrieved_chunks else 0.0
        top_rerank = reranked[0].similarity_score if reranked else 0.0

        # Step 6: Multi-signal confidence calculation
        has_exact_match = any(c.match_type == "exact_error" for c in retrieved_chunks)
        has_machine_match = bool(target_machine)

        confidence_eval = self.confidence_evaluator.evaluate(
            has_exact_error_match=has_exact_match,
            has_machine_match=has_machine_match,
            top_similarity_score=top_similarity,
            top_rerank_score=top_rerank,
            source_count=len(reranked),
            is_ambiguous=False,
        )

        # Step 7: Evidence sufficiency check (hallucination prevention & refusal)
        if len(reranked) < MIN_EVIDENCE_CHUNKS or (confidence_eval.level == "LOW" and not has_exact_match):
            logger.info("Low confidence / insufficient evidence -> refusing unsupported answer.")
            return RAGResponse(
                problem="Insufficient Information",
                diagnosis="No sufficiently supported documentation was retrieved from the available service manuals.",
                answer=(
                    "Insufficient information in the available sources. I will not recommend an unsupported repair procedure. "
                    "Please verify that the correct machine manual or error log has been uploaded."
                ),
                probable_causes=[],
                corrective_steps=[],
                recommended_solutions=[],
                confidence=confidence_eval.score,
                confidence_level="LOW",
                confidence_reasons=confidence_eval.reasons + ["Evidence falls below the minimum required threshold."],
                is_insufficient=True,
                insufficient_message="Insufficient documentation found for this issue in the knowledge base.",
                detected_error_code=detected_errors[0] if detected_errors else None,
                detected_machine=target_machine,
                conversation_id=request.conversation_id,
            )

        # Step 8: Answer generation with OpenAI
        reranked_dicts = [self._chunk_to_dict(c) for c in reranked]
        gen_output = self.answer_generator.generate_response(
            query=query,
            context_chunks=reranked_dicts,
            machine_model=target_machine,
            detected_error_code=detected_errors[0] if detected_errors else None,
            conversation_history=conversation_history,
        )

        # Step 9: Solution ranking
        raw_solutions = gen_output.get("recommended_solutions", [])
        ranked_solutions = self.solution_ranker.rank_solutions(raw_solutions, reranked_dicts)
        solution_objs = [RecommendedSolution(**s) for s in ranked_solutions]

        # Step 10: Citations & Evidence page highlighting
        citations: list[Citation] = []
        evidence_images: list[dict[str, Any]] = []

        for idx, chunk in enumerate(reranked, 1):
            manual_name = chunk.manual_title or chunk.manual_id
            page_num = chunk.page_number
            img_url = None

            # Attempt real PDF page rendering with yellow highlight
            highlight_terms = detected_errors + [query[:20]]
            pdf_path = os.path.join(settings.MANUALS_DIR, f"{chunk.manual_id}.pdf")
            if not os.path.exists(pdf_path):
                # Search by manual title in manuals directory
                for f in os.listdir(settings.MANUALS_DIR):
                    if f.endswith(".pdf") and (chunk.manual_id in f or (manual_name and manual_name in f)):
                        pdf_path = os.path.join(settings.MANUALS_DIR, f)
                        break

            out_filename = f"evidence_{chunk.manual_id}_p{page_num}.png"
            highlighted_file = self.highlighter.highlight_pdf_page(
                pdf_path=pdf_path,
                page_number=page_num,
                search_terms=highlight_terms,
                output_name=out_filename,
            )

            if highlighted_file and os.path.exists(highlighted_file):
                img_url = f"/api/evidence/{out_filename}"
                evidence_images.append({
                    "path": highlighted_file,
                    "url": img_url,
                    "caption": f"{manual_name} — Page {page_num}",
                })

            citations.append(
                Citation(
                    manual=manual_name,
                    machine_model=chunk.machine_model or target_machine or "Universal",
                    section=chunk.section or "General",
                    page=page_num,
                    chunk_id=chunk.id,
                    relevance_score=chunk.similarity_score,
                    source_type=chunk.metadata.get("source_type", "pdf"),
                    file_name=chunk.metadata.get("file_name"),
                    evidence_image_url=img_url,
                )
            )

        # Assemble full diagnosis answer
        answer_text = gen_output.get("diagnosis", "")
        if gen_output.get("probable_causes"):
            answer_text += "\n\n**Probable Causes:**\n" + "\n".join(f"- {c}" for c in gen_output["probable_causes"])

        return RAGResponse(
            problem=gen_output.get("problem") or query,
            diagnosis=gen_output.get("diagnosis", ""),
            answer=answer_text,
            probable_causes=gen_output.get("probable_causes", []),
            corrective_steps=[s.action for s in solution_objs],
            recommended_solutions=solution_objs,
            safety_warnings=gen_output.get("safety_warnings", []),
            confidence=confidence_eval.score,
            confidence_level=confidence_eval.level,
            confidence_reasons=confidence_eval.reasons,
            citations=citations,
            evidence_images=evidence_images,
            is_ambiguous=False,
            is_insufficient=False,
            detected_error_code=detected_errors[0] if detected_errors else None,
            detected_machine=target_machine,
            query_type=analysis_dict.get("intent", "troubleshoot"),
            conversation_id=request.conversation_id,
        )

    @staticmethod
    def _chunk_to_dict(chunk: RetrievedChunk) -> dict[str, Any]:
        return {
            "id": chunk.id,
            "content": chunk.content,
            "page_number": chunk.page_number,
            "section": chunk.section,
            "error_codes": chunk.error_codes,
            "manual_id": chunk.manual_id,
            "manual_title": chunk.manual_title,
            "machine_id": chunk.machine_id,
            "machine_model": chunk.machine_model,
            "similarity_score": chunk.similarity_score,
            "match_type": chunk.match_type,
            "metadata": chunk.metadata,
        }

    async def _enrich_chunks(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Fetch manual title and machine model for retrieved chunks."""
        try:
            client = get_supabase_client()
            manual_ids = {c.manual_id for c in chunks}
            machine_ids = {c.machine_id for c in chunks}

            manual_map: dict[str, str] = {}
            if manual_ids:
                res = client.table("manuals").select("id, title").in_("id", list(manual_ids)).execute()
                manual_map = {r["id"]: r["title"] for r in res.data}

            machine_map: dict[str, str] = {}
            if machine_ids:
                res = client.table("machines").select("id, model_number").in_("id", list(machine_ids)).execute()
                machine_map = {r["id"]: r["model_number"] for r in res.data}

            for c in chunks:
                c.manual_title = manual_map.get(c.manual_id, c.manual_id)
                c.machine_model = machine_map.get(c.machine_id, c.machine_id)
        except Exception as e:
            logger.warning(f"Failed to enrich chunks from database: {e}")

        return chunks

    async def _get_conversation_history(self, conversation_id: str) -> Optional[list[dict]]:
        try:
            client = get_supabase_client()
            res = (
                client.table("messages")
                .select("role, content")
                .eq("conversation_id", conversation_id)
                .order("created_at")
                .limit(10)
                .execute()
            )
            return res.data if res.data else None
        except Exception as e:
            logger.warning(f"Failed to fetch conversation history: {e}")
            return None

    @staticmethod
    def _extract_machine_from_history(history: list[dict]) -> Optional[str]:
        from app.services.llm.query_analysis import MACHINE_MODEL_REGEX
        for msg in reversed(history):
            content = msg.get("content", "")
            matches = MACHINE_MODEL_REGEX.findall(content)
            if matches:
                return matches[0].upper()
        return None
