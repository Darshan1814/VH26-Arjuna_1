"""RAG Pipeline: orchestrates the full retrieval-augmented generation flow.

Query → Analyze → Retrieve → Rerank → Evidence Check → Generate → Cite

This is the central orchestrator. Each step is delegated to a
dedicated service to keep the logic modular and testable.
"""

import logging
from typing import Optional

from app.core.database import get_supabase_client
from app.schemas.query import RAGQueryRequest
from app.schemas.rag_response import RAGResponse
from app.services.retrieval.query_analyzer import QueryAnalyzer
from app.services.retrieval.hybrid_retriever import HybridRetriever, RetrievedChunk
from app.services.reranking.reranker import Reranker
from app.services.llm.groq_client import GroqClient
from app.services.citations.citation_builder import CitationBuilder

logger = logging.getLogger(__name__)

# Minimum number of relevant chunks needed to proceed with generation
MIN_EVIDENCE_CHUNKS = 1
# Minimum reranker score to consider a chunk as relevant evidence
MIN_EVIDENCE_SCORE = 0.1


class RAGPipeline:
    """Orchestrate the full RAG pipeline for troubleshooting queries."""

    def __init__(self) -> None:
        self.query_analyzer = QueryAnalyzer()
        self.retriever = HybridRetriever()
        self.reranker = Reranker()
        self.groq_client = GroqClient()
        self.citation_builder = CitationBuilder()

    async def process_query(self, request: RAGQueryRequest) -> RAGResponse:
        """Process a troubleshooting query through the full RAG pipeline.

        Args:
            request: The RAG query request with query text and optional filters.

        Returns:
            Structured RAGResponse with answer, citations, and state flags.
        """
        logger.info(f"Processing query: {request.query[:100]}...")

        # Step 1: Analyze the query
        analysis = self.query_analyzer.analyze(
            query=request.query,
            machine_id=request.machine_id,
        )

        # Step 2: Retrieve relevant chunks
        retrieved_chunks = await self.retriever.retrieve(
            analysis=analysis,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
        )

        # Step 3: Check for cross-manual ambiguity
        ambiguity = self._check_ambiguity(analysis, retrieved_chunks)
        if ambiguity:
            return ambiguity

        # Step 4: Rerank results
        reranked_chunks = self.reranker.rerank(
            query=request.query,
            chunks=retrieved_chunks,
            top_k=request.rerank_top_k,
        )

        # Step 5: Evidence sufficiency check (hallucination prevention)
        if not self._has_sufficient_evidence(reranked_chunks):
            return self._insufficient_response(analysis)

        # Step 6: Enrich chunks with manual/machine names
        enriched_chunks = await self._enrich_chunks(reranked_chunks)

        # Step 7: Generate response with Groq
        conversation_history = None
        if request.conversation_id:
            conversation_history = await self._get_conversation_history(
                request.conversation_id
            )

        llm_response = await self.groq_client.generate(
            query=request.query,
            context_chunks=enriched_chunks,
            conversation_history=conversation_history,
        )

        # Step 8: Build citations
        citations = self.citation_builder.build_citations(enriched_chunks)

        # Step 9: Assemble final response
        return RAGResponse(
            answer=llm_response.get("answer", ""),
            probable_causes=llm_response.get("probable_causes", []),
            corrective_steps=llm_response.get("corrective_steps", []),
            confidence=llm_response.get("confidence", 0.0),
            citations=citations,
            detected_error_code=(
                analysis.error_codes[0] if analysis.error_codes else None
            ),
            detected_machine=analysis.machine_model,
            query_type=analysis.query_type,
            conversation_id=request.conversation_id,
        )

    def _check_ambiguity(
        self,
        analysis,
        chunks: list[RetrievedChunk],
    ) -> Optional[RAGResponse]:
        """Detect cross-manual ambiguity for error codes.

        If an error code exists in chunks from multiple machines
        and no specific machine was requested, return an ambiguity response.
        """
        if not analysis.error_codes or analysis.machine_id:
            return None

        # Check how many distinct machines the error code appears in
        machine_ids = set()
        machine_models = set()
        for chunk in chunks:
            if any(code in chunk.error_codes for code in analysis.error_codes):
                machine_ids.add(chunk.machine_id)
                if chunk.machine_model:
                    machine_models.add(chunk.machine_model)

        if len(machine_ids) > 1:
            models_list = sorted(machine_models) if machine_models else sorted(machine_ids)
            error_code = analysis.error_codes[0]

            logger.info(
                f"Ambiguity detected: {error_code} found in "
                f"{len(machine_ids)} machines: {models_list}"
            )

            return RAGResponse(
                answer=(
                    f"Error code {error_code} exists in multiple machine manuals "
                    f"with different meanings. Which machine model are you "
                    f"troubleshooting?"
                ),
                is_ambiguous=True,
                ambiguity_message=(
                    f"Error code {error_code} was found in manuals for: "
                    f"{', '.join(models_list)}. "
                    f"Please specify which machine you need help with."
                ),
                ambiguous_machines=models_list,
                detected_error_code=error_code,
                query_type=analysis.query_type,
                confidence=0.0,
            )

        return None

    def _has_sufficient_evidence(self, chunks: list[RetrievedChunk]) -> bool:
        """Check if retrieved evidence is sufficient for generation.

        Returns False if we don't have enough relevant chunks,
        which prevents the LLM from hallucinating an answer.
        """
        if len(chunks) < MIN_EVIDENCE_CHUNKS:
            return False

        # Check if the top chunk has a reasonable reranker score
        if chunks[0].similarity_score < MIN_EVIDENCE_SCORE:
            logger.warning(
                f"Top chunk score ({chunks[0].similarity_score:.4f}) "
                f"below threshold ({MIN_EVIDENCE_SCORE})"
            )
            return False

        return True

    def _insufficient_response(self, analysis) -> RAGResponse:
        """Return a response indicating insufficient evidence."""
        return RAGResponse(
            answer=(
                "I could not find sufficient evidence in the available "
                "manuals to answer this question. I will not recommend "
                "a repair based on unsupported information."
            ),
            is_insufficient=True,
            insufficient_message=(
                "No relevant documentation was found for this query. "
                "Please check that the relevant machine manual has been "
                "uploaded and processed."
            ),
            detected_error_code=(
                analysis.error_codes[0] if analysis.error_codes else None
            ),
            detected_machine=analysis.machine_model,
            query_type=analysis.query_type,
            confidence=0.0,
        )

    async def _enrich_chunks(
        self,
        chunks: list[RetrievedChunk],
    ) -> list[RetrievedChunk]:
        """Add manual titles and machine model numbers to chunks."""
        try:
            client = get_supabase_client()

            # Get unique manual and machine IDs
            manual_ids = {c.manual_id for c in chunks}
            machine_ids = {c.machine_id for c in chunks}

            # Fetch manual titles
            manual_map: dict[str, str] = {}
            if manual_ids:
                result = (
                    client.table("manuals")
                    .select("id, title")
                    .in_("id", list(manual_ids))
                    .execute()
                )
                manual_map = {r["id"]: r["title"] for r in result.data}

            # Fetch machine models
            machine_map: dict[str, str] = {}
            if machine_ids:
                result = (
                    client.table("machines")
                    .select("id, model_number")
                    .in_("id", list(machine_ids))
                    .execute()
                )
                machine_map = {r["id"]: r["model_number"] for r in result.data}

            # Enrich chunks
            for chunk in chunks:
                chunk.manual_title = manual_map.get(chunk.manual_id, chunk.manual_id)
                chunk.machine_model = machine_map.get(chunk.machine_id, chunk.machine_id)

        except Exception as e:
            logger.warning(f"Could not enrich chunks: {e}")

        return chunks

    async def _get_conversation_history(
        self,
        conversation_id: str,
    ) -> Optional[list[dict]]:
        """Fetch conversation history for context continuity."""
        try:
            client = get_supabase_client()
            result = (
                client.table("messages")
                .select("role, content")
                .eq("conversation_id", conversation_id)
                .order("created_at")
                .limit(10)
                .execute()
            )
            return result.data if result.data else None
        except Exception as e:
            logger.warning(f"Could not fetch conversation history: {e}")
            return None
