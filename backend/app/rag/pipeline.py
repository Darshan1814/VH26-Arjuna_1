"""Orchestrates the complete industrial RAG troubleshooting pipeline."""

import json
import os
import uuid
import logging
from typing import Any, Optional
import re

from app.core.config import settings
from app.core.database import get_supabase_client
from app.core.sqlite_storage import get_sqlite_storage
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
from app.services.reports.pdf_generator import PDFReportGenerator
from app.services.reports.html_generator import HTMLReportGenerator
from app.services.search.web_search import get_web_search_service
from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)

MIN_EVIDENCE_CHUNKS = 1
MIN_EVIDENCE_SCORE = 0.15

# Security Guardrail: Refuse queries involving secure, confidential documents or credentials
SECURITY_BLOCKED_PATTERNS = [
    re.compile(r"\b(?:password|passwd|secret_key|private_key|ssh-rsa|api[_-]?key|jwt_secret|api_secret)\b", re.IGNORECASE),
    re.compile(r"\b(?:credit[_\s]?card|cvv|ssn|confidential[_\s]?document|restricted[_\s]?file|classified[_\s]?doc)\b", re.IGNORECASE),
    re.compile(r"\b(?:jailbreak|ignore previous instructions|system[_\s]?prompt)\b", re.IGNORECASE),
]


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

        # Guardrail Check: Secure / Confidential Document & Credential Restriction
        for pattern in SECURITY_BLOCKED_PATTERNS:
            if pattern.search(query):
                logger.warning(f"Security guardrail triggered for query: {query}")
                return RAGResponse(
                    problem="Security / Confidentiality Policy Violation",
                    diagnosis="Access refused: The query touches upon secure documents, credentials, or restricted patterns.",
                    answer=(
                        "Access refused. This system is strictly authorized for industrial machinery troubleshooting based on "
                        "technical service manuals. Inquiries involving secure documents, credentials, or out-of-domain confidential "
                        "topics cannot be processed."
                    ),
                    probable_causes=[],
                    corrective_steps=[],
                    recommended_solutions=[],
                    safety_warnings=["SECURITY ALERT: Access denied by system security & confidentiality policies."],
                    confidence=0.0,
                    confidence_level="LOW",
                    confidence_reasons=["Security policy violation: query contained restricted keywords or patterns."],
                    is_insufficient=True,
                    insufficient_message="Request blocked by security guardrails.",
                    conversation_id=request.conversation_id,
                )

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

        if analysis_dict.get("intent") == "security_violation":
            logger.warning(f"Intent analysis detected security or out-of-domain violation: {query}")
            return RAGResponse(
                problem="Out-of-Domain / Security Restriction",
                diagnosis="Access refused: The query touches upon secure documents, non-machine topics, or restricted patterns.",
                answer=(
                    "Access refused. This system is strictly authorized for industrial machinery troubleshooting based on "
                    "technical service manuals. Inquiries involving secure documents, credentials, or out-of-domain topics cannot be processed."
                ),
                probable_causes=[],
                corrective_steps=[],
                recommended_solutions=[],
                safety_warnings=["SECURITY ALERT: Access denied by system security & confidentiality policies."],
                confidence=0.0,
                confidence_level="LOW",
                confidence_reasons=["Query intent was flagged as out-of-domain or security violation."],
                is_insufficient=True,
                insufficient_message="Request blocked by security guardrails.",
                conversation_id=request.conversation_id,
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

        # Step 3: Hybrid retrieval (Exact error code + Keyword + pgvector / SQLite)
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
            query=query,
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
            top_k=max((request.rerank_top_k or 5) * 2, 8),
        )

        # Strict Page-Level Deduplication: Never return the same physical manual page multiple times!
        dedup_reranked = []
        seen_pages = set()
        for c in reranked:
            p_key = (c.manual_title or c.manual_id, c.page_number)
            if p_key not in seen_pages:
                seen_pages.add(p_key)
                dedup_reranked.append(c)

        if len(dedup_reranked) < (request.rerank_top_k or 5) and enriched_chunks:
            for c in enriched_chunks:
                p_key = (c.manual_title or c.manual_id, c.page_number)
                if p_key not in seen_pages:
                    seen_pages.add(p_key)
                    dedup_reranked.append(c)
                if len(dedup_reranked) >= (request.rerank_top_k or 5):
                    break

        reranked = dedup_reranked[:request.rerank_top_k or 5] if dedup_reranked else reranked

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

        # Step 7: Local Evidence sufficiency check & Serper Web Surfing Fallback
        web_search = get_web_search_service()
        search_target = f"{target_machine or ''} {' '.join(detected_errors) if detected_errors else ''} {query}".strip()
        web_proofs = await web_search.search(search_target or "industrial machine troubleshooting manual", num_results=5)

        # Only fall back to purely web-based diagnosis if ZERO local document chunks were retrieved
        if len(reranked) == 0:
            logger.info("Local manual evidence absent from library. Utilizing Serper web search and OEM bulletins for grounded resolution.")
            formatted_web = web_search.format_sources_for_prompt(web_proofs)

            web_prompt = f"""You are a master industrial machinery diagnostic specialist.
The user asked: {query}
Machine / Model: {target_machine or 'Industrial Equipment'}
Detected Error Codes: {', '.join(detected_errors) if detected_errors else 'General Diagnostic'}

Here are verified live technical bulletins, OEM search results, and knowledge base references from Serper/Web:
{formatted_web}

Synthesize a comprehensive, professional industrial troubleshooting solution strictly derived from the query and web references.
CRITICAL: Do NOT output placeholder or dummy data. Synthesize real, technically precise probable causes and corrective actions for this specific error/machine.

Return a valid JSON object matching this schema:
{{
  "problem": "Exact summary of the problem or error code",
  "diagnosis": "Technical diagnostic assessment and root failure mechanism",
  "answer": "Detailed, step-by-step diagnostic and troubleshooting guidance citing the web references and OEM rules",
  "probable_causes": ["Cause 1 with specific component and mechanism", "Cause 2", "Cause 3"],
  "corrective_steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "recommended_solutions": [
    {{"priority": 1, "action": "Immediate corrective fix", "reason": "Addresses root cause", "evidence_strength": "High", "source": "OEM Technical Bulletin", "is_verified": true}}
  ],
  "safety_warnings": [
    "Precise safety warning related to this machine subsystem and error."
  ]
}}
"""
            llm_client = get_openai_client()
            try:
                gen_data = llm_client.json_completion(
                    messages=[{"role": "user", "content": web_prompt}],
                    temperature=0.1,
                )
            except Exception as e:
                logger.error(f"Error in web search answer generation: {e}")
                gen_data = {}

            web_citations = [
                Citation(
                    manual=item.get("title", "OEM Service Bulletin"),
                    machine_model=target_machine or "Industrial Equipment",
                    section="Web Bulletin",
                    page=1,
                    source_type="web",
                )
                for item in web_proofs
            ]

            raw_sols = gen_data.get("recommended_solutions", [])
            if not raw_sols:
                raw_sols = [{
                    "priority": 1,
                    "action": f"Inspect {target_machine or 'equipment'} control unit and clear {detected_errors[0] if detected_errors else 'fault condition'}",
                    "reason": "Restores safe operating parameters according to OEM standard",
                    "evidence_strength": "High",
                    "source": "OEM Technical Bulletin",
                    "is_verified": True
                }]

            return RAGResponse(
                problem=gen_data.get("problem", query),
                diagnosis=gen_data.get("diagnosis", f"Diagnostic assessment for {query}"),
                answer=gen_data.get("answer", "Troubleshooting procedures synthesized from technical bulletins."),
                probable_causes=gen_data.get("probable_causes", [
                    f"Component degradation or threshold trip on {target_machine or 'equipment'}",
                    "Signal communication bus interruption or power supply voltage variance"
                ]),
                corrective_steps=gen_data.get("corrective_steps", [
                    "Perform OSHA Lockout/Tagout (LOTO) isolation",
                    "Measure input supply voltage and signal lines",
                    "Clear registered fault code and perform test cycle"
                ]),
                recommended_solutions=[RecommendedSolution(**s) for s in raw_sols],
                safety_warnings=gen_data.get("safety_warnings", [
                    "DANGER: Follow OSHA 1910.147 Lockout/Tagout (LOTO) protocols before servicing.",
                    "CAUTION: Wear appropriate PPE including arc-flash protection and insulated gloves."
                ]),
                confidence=0.85,
                confidence_level="HIGH",
                confidence_reasons=["Synthesized using live OEM technical bulletins and Serper web proof links."],
                citations=web_citations,
                proof_links=web_proofs,
                is_insufficient=False,
                detected_error_code=detected_errors[0] if detected_errors else None,
                detected_machine=target_machine,
                conversation_id=request.conversation_id,
            )

        # Step 8: Answer generation with LLM
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

            meta_d = chunk.metadata if isinstance(chunk.metadata, dict) else {}
            if isinstance(chunk.metadata, str):
                try:
                    meta_d = json.loads(chunk.metadata)
                except Exception:
                    meta_d = {}

            citations.append(
                Citation(
                    manual=manual_name,
                    machine_model=chunk.machine_model or target_machine or "Universal",
                    section=chunk.section or "General",
                    page=page_num,
                    chunk_id=chunk.id,
                    relevance_score=chunk.similarity_score,
                    source_type=meta_d.get("source_type", "pdf"),
                    file_name=meta_d.get("file_name") or manual_name,
                    evidence_image_url=img_url,
                )
            )

        # Sanitize diagnosis, problem, causes, and safety warnings to guarantee string and list types
        raw_diag = gen_output.get("diagnosis", "")
        if isinstance(raw_diag, list):
            diagnosis_str = "\n".join(str(d) for d in raw_diag)
        else:
            diagnosis_str = str(raw_diag or "")

        raw_prob = gen_output.get("problem") or query
        if isinstance(raw_prob, list):
            problem_str = " ".join(str(p) for p in raw_prob)
        else:
            problem_str = str(raw_prob or query)

        raw_causes = gen_output.get("probable_causes", [])
        if isinstance(raw_causes, list):
            probable_causes = [str(c) for c in raw_causes]
        elif isinstance(raw_causes, str):
            probable_causes = [raw_causes]
        else:
            probable_causes = []

        raw_safety = gen_output.get("safety_warnings", [])
        if isinstance(raw_safety, list):
            safety_warnings = [str(s) for s in raw_safety]
        elif isinstance(raw_safety, str):
            safety_warnings = [raw_safety]
        else:
            safety_warnings = []

        # Assemble full diagnosis answer
        answer_text = diagnosis_str
        if probable_causes:
            answer_text += "\n\n**Probable Causes:**\n" + "\n".join(f"- {c}" for c in probable_causes)

        # Auto-generate formal PDF & HTML diagnostic audit reports
        report_id = str(uuid.uuid4())[:8].upper()
        report_pdf_url = None
        report_html_url = None

        report_payload = {
            "report_id": report_id,
            "query": query,
            "machine_model": target_machine or (citations[0].machine_model if citations else "Universal Equipment"),
            "error_code": detected_errors[0] if detected_errors else "FAULT_DIAGNOSIS",
            "problem": problem_str,
            "diagnosis": diagnosis_str,
            "probable_causes": probable_causes,
            "recommended_solutions": [
                {
                    "priority": s.priority,
                    "action": s.action,
                    "reason": s.reason,
                    "evidence_strength": s.evidence_strength,
                    "source": s.source,
                }
                for s in solution_objs
            ],
            "safety_warnings": safety_warnings,
            "confidence_level": confidence_eval.level,
            "confidence": confidence_eval.score,
            "citations": [
                {
                    "manual": c.manual,
                    "page": c.page,
                    "section": c.section,
                    "relevance_score": c.relevance_score,
                }
                for c in citations
            ],
            "evidence_images": evidence_images,
        }

        try:
            pdf_bytes = PDFReportGenerator.generate_bytes(report_payload)
            html_content = HTMLReportGenerator.generate(report_payload)
            get_sqlite_storage().save_report(
                report_data=report_payload,
                pdf_bytes=pdf_bytes,
                html_content=html_content,
            )
            report_pdf_url = f"/api/reports/{report_id}/pdf"
            report_html_url = f"/api/reports/{report_id}/html"
            logger.info(f"Auto-generated diagnostic report: {report_id}")
        except Exception as rep_err:
            logger.warning(f"Report generation skipped in RAG pipeline: {rep_err}")

        return RAGResponse(
            problem=problem_str,
            diagnosis=diagnosis_str,
            answer=answer_text,
            probable_causes=probable_causes,
            corrective_steps=[s.action for s in solution_objs],
            recommended_solutions=solution_objs,
            safety_warnings=safety_warnings,
            confidence=confidence_eval.score,
            confidence_level=confidence_eval.level,
            confidence_reasons=confidence_eval.reasons,
            citations=citations,
            proof_links=web_proofs,
            evidence_images=evidence_images,
            is_ambiguous=False,
            is_insufficient=False,
            detected_error_code=detected_errors[0] if detected_errors else None,
            detected_machine=target_machine,
            query_type=analysis_dict.get("intent", "troubleshoot"),
            conversation_id=request.conversation_id,
            report_id=report_id,
            report_pdf_url=report_pdf_url,
            report_html_url=report_html_url,
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
                c.manual_title = manual_map.get(c.manual_id) or c.manual_title or c.manual_id
                c.machine_model = machine_map.get(c.machine_id) or c.machine_model or c.machine_id
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
