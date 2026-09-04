"""Hybrid retrieval: vector search + exact error code match + metadata filtering.

Combines multiple retrieval strategies to find the most relevant chunks:
1. Exact error code matching (highest priority)
2. Vector similarity search via pgvector
3. Metadata filtering (machine_id, manual_id)

Results are merged and deduplicated before reranking.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.embeddings.embedding_provider import EmbeddingProvider
from app.services.retrieval.query_analyzer import QueryAnalysis

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    """A document chunk retrieved from the database with relevance metadata."""

    id: str
    content: str
    page_number: int
    section: str
    chunk_index: int
    error_codes: list[str]
    manual_id: str
    machine_id: str
    manual_title: str = ""
    machine_model: str = ""
    similarity_score: float = 0.0
    match_type: str = "vector"  # "exact_error", "keyword", "vector"
    metadata: dict = field(default_factory=dict)


class HybridRetriever:
    """Retrieve relevant document chunks using multiple strategies."""

    def __init__(self, embedding_provider: Optional[EmbeddingProvider] = None) -> None:
        self._embedding_provider = embedding_provider

    @property
    def embedding_provider(self) -> EmbeddingProvider:
        if self._embedding_provider is None:
            self._embedding_provider = EmbeddingProvider()
        return self._embedding_provider

    async def retrieve(
        self,
        analysis: QueryAnalysis,
        top_k: int = 10,
        similarity_threshold: float = 0.3,
    ) -> list[RetrievedChunk]:
        """Execute hybrid retrieval: exact error codes + full-text keywords + pgvector."""
        all_chunks: list[RetrievedChunk] = []

        # Strategy 1: Exact error code matching
        if analysis.error_codes:
            exact_chunks = await self._exact_error_search(
                error_codes=analysis.error_codes,
                machine_id=analysis.machine_id,
            )
            all_chunks.extend(exact_chunks)

        # Strategy 2: Keyword full-text search
        keyword_chunks = await self._keyword_search(
            query=analysis.semantic_query,
            machine_id=analysis.machine_id,
        )
        all_chunks.extend(keyword_chunks)

        # Strategy 3: Vector similarity search via pgvector
        vector_chunks = await self._vector_search(
            query=analysis.semantic_query,
            machine_id=analysis.machine_id,
            top_k=top_k,
            threshold=similarity_threshold,
        )
        all_chunks.extend(vector_chunks)

        # Fallback to local manuals directory if database search returned 0 results
        if not all_chunks:
            local_chunks = self._search_local_chunks(analysis)
            all_chunks.extend(local_chunks)

        # Deduplicate and sort
        deduped = self._deduplicate(all_chunks)
        deduped.sort(
            key=lambda c: (
                0 if c.match_type == "exact_error" else (1 if c.match_type == "keyword" else 2),
                -c.similarity_score,
            )
        )
        return deduped[:top_k]

    def _search_local_chunks(self, analysis: QueryAnalysis) -> list[RetrievedChunk]:
        """Search local database chunks and disk cache when remote pgvector is unreachable."""
        import os
        import json
        import uuid

        results = []

        # 1. Search SQLite vector database table
        try:
            from app.core.sqlite_storage import get_sqlite_storage
            sql_chunks = get_sqlite_storage().search_chunks(
                query_text=analysis.semantic_query,
                machine_model=analysis.machine_id,
                error_code=analysis.error_codes[0] if analysis.error_codes else None,
                top_k=10,
            )
            for sc in sql_chunks:
                raw_errs = sc.get("error_codes")
                err_list = []
                if isinstance(raw_errs, str):
                    try:
                        err_list = json.loads(raw_errs)
                    except Exception:
                        err_list = [raw_errs] if raw_errs else []
                elif isinstance(raw_errs, list):
                    err_list = raw_errs
                if not err_list and sc.get("error_code"):
                    err_list = [sc["error_code"]]

                machine_val = sc.get("machine") or sc.get("machine_model") or "Universal"
                meta_raw = sc.get("metadata")
                meta_dict = {}
                if isinstance(meta_raw, dict):
                    meta_dict = meta_raw
                elif isinstance(meta_raw, str):
                    try:
                        meta_dict = json.loads(meta_raw)
                    except Exception:
                        meta_dict = {}

                content_str = sc.get("content", "")
                is_exact_err = any(
                    e.lower() in analysis.original_query.lower() or (analysis.error_codes and e.upper() in [ec.upper() for ec in analysis.error_codes])
                    for e in err_list
                )
                m_type = "exact_error" if is_exact_err else sc.get("match_type", "vector")
                sim_score = 0.99 if is_exact_err else sc.get("similarity_score", 0.85)

                results.append(
                    RetrievedChunk(
                        id=sc.get("id") or str(uuid.uuid4())[:8],
                        content=content_str,
                        page_number=sc.get("page_number", 1),
                        section=sc.get("section", "General"),
                        chunk_index=sc.get("chunk_index", 0),
                        error_codes=err_list,
                        manual_id=sc.get("filename", "Manual"),
                        machine_id=machine_val,
                        manual_title=sc.get("filename", "Technical Service Manual"),
                        machine_model=machine_val,
                        similarity_score=sim_score,
                        match_type=m_type,
                        metadata=meta_dict,
                    )
                )
        except Exception as sql_e:
            logger.warning(f"Could not retrieve from SQLite chunks: {sql_e}")

        # 2. Check disk chunks JSON
        if os.path.exists(settings.MANUALS_DIR):
            query_lower = analysis.original_query.lower()
            terms = [t for t in query_lower.split() if len(t) > 2]
            for fname in os.listdir(settings.MANUALS_DIR):
                if fname.endswith(".chunks.json"):
                    try:
                        with open(os.path.join(settings.MANUALS_DIR, fname), "r", encoding="utf-8") as f:
                            cached_chunks = json.load(f)
                        for c in cached_chunks:
                            chunk_machine = (c.get("machine_model") or "").strip()
                            content_lower = c.get("content", "").lower()
                            meta_machines = [str(m).lower() for m in c.get("metadata", {}).get("machine_models", [])]

                            if analysis.machine_id:
                                mach_req = analysis.machine_id.lower()
                                is_mach_match = (
                                    not chunk_machine
                                    or mach_req in chunk_machine.lower()
                                    or chunk_machine.lower() in mach_req
                                    or mach_req in content_lower
                                    or any(mach_req in m or m in mach_req for m in meta_machines)
                                )
                                if not is_mach_match:
                                    continue

                            score = sum(1 for t in terms if t in content_lower) / max(len(terms), 1)
                            is_error_match = any(e.lower() in query_lower for e in c.get("error_codes", []))
                            if score > 0.05 or is_error_match or (analysis.machine_id and analysis.machine_id.lower() in content_lower):
                                m_type = "exact_error" if is_error_match else "keyword"
                                sim_score = 0.98 if is_error_match else min(0.75 + score * 0.25, 0.96)
                                results.append(
                                    RetrievedChunk(
                                        id=str(uuid.uuid4())[:8],
                                        content=c.get("content", ""),
                                        page_number=c.get("page_number", 1),
                                        section=c.get("section", "General"),
                                        chunk_index=c.get("chunk_index", 0),
                                        error_codes=c.get("error_codes", []),
                                        manual_id=c.get("file_name") or fname.replace(".chunks.json", ""),
                                        machine_id=chunk_machine or analysis.machine_id or "Universal Machine",
                                        manual_title=c.get("file_name") or fname.replace(".chunks.json", ""),
                                        machine_model=chunk_machine or analysis.machine_id or "Universal Machine",
                                        similarity_score=sim_score,
                                        match_type=m_type,
                                        metadata=c.get("metadata", {}),
                                    )
                                )
                    except Exception as err:
                        logger.warning(f"Error reading local chunk file {fname}: {err}")

        return results

    async def _keyword_search(
        self,
        query: str,
        machine_id: Optional[str] = None,
    ) -> list[RetrievedChunk]:
        """Search text content using keyword pattern matching."""
        terms = [t for t in query.split() if len(t) > 3][:4]
        if not terms:
            return []
        try:
            client = get_supabase_client()
            search_query = client.table("document_chunks").select(
                "id, content, page_number, section, chunk_index, error_codes, manual_id, machine_id, metadata"
            )
            if machine_id:
                search_query = search_query.eq("machine_id", machine_id)

            pattern = f"%{terms[0]}%"
            result = search_query.ilike("content", pattern).limit(10).execute()

            chunks = []
            for row in result.data:
                chunks.append(
                    RetrievedChunk(
                        id=row["id"],
                        content=row["content"],
                        page_number=row["page_number"],
                        section=row.get("section", ""),
                        chunk_index=row.get("chunk_index", 0),
                        error_codes=row.get("error_codes", []),
                        manual_id=row["manual_id"],
                        machine_id=row["machine_id"],
                        similarity_score=0.85,
                        match_type="keyword",
                        metadata=row.get("metadata", {}),
                    )
                )
            return chunks
        except Exception as e:
            logger.warning(f"Keyword search error: {e}")
            return []

    async def _exact_error_search(
        self,
        error_codes: list[str],
        machine_id: Optional[str] = None,
    ) -> list[RetrievedChunk]:
        """Find chunks containing specific error codes."""
        try:
            client = get_supabase_client()
            query = (
                client.table("document_chunks")
                .select(
                    "id, content, page_number, section, chunk_index, "
                    "error_codes, manual_id, machine_id, metadata"
                )
                .overlaps("error_codes", error_codes)
            )

            if machine_id:
                query = query.eq("machine_id", machine_id)

            result = query.limit(20).execute()

            chunks = []
            for row in result.data:
                chunks.append(
                    RetrievedChunk(
                        id=row["id"],
                        content=row["content"],
                        page_number=row["page_number"],
                        section=row.get("section", ""),
                        chunk_index=row.get("chunk_index", 0),
                        error_codes=row.get("error_codes", []),
                        manual_id=row["manual_id"],
                        machine_id=row["machine_id"],
                        similarity_score=1.0,  # Exact match gets highest score
                        match_type="exact_error",
                        metadata=row.get("metadata", {}),
                    )
                )

            return chunks

        except Exception as e:
            logger.error(f"Exact error search failed: {e}")
            return []

    async def _vector_search(
        self,
        query: str,
        machine_id: Optional[str] = None,
        top_k: int = 10,
        threshold: float = 0.3,
    ) -> list[RetrievedChunk]:
        """Perform vector similarity search using pgvector.

        Uses the match_document_chunks Supabase function which runs
        cosine similarity via pgvector.
        """
        try:
            # Generate query embedding
            query_embedding = self.embedding_provider.embed_text(query)

            client = get_supabase_client()

            # Call the Supabase RPC function for similarity search
            params = {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "similarity_threshold": threshold,
            }

            if machine_id:
                params["filter_machine_id"] = machine_id

            result = client.rpc("match_document_chunks", params).execute()

            chunks = []
            for row in result.data:
                chunks.append(
                    RetrievedChunk(
                        id=row["id"],
                        content=row["content"],
                        page_number=row["page_number"],
                        section=row.get("section", ""),
                        chunk_index=row.get("chunk_index", 0),
                        error_codes=row.get("error_codes", []),
                        manual_id=row["manual_id"],
                        machine_id=row["machine_id"],
                        similarity_score=row.get("similarity", 0.0),
                        match_type="vector",
                        metadata=row.get("metadata", {}),
                    )
                )

            return chunks

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    def _deduplicate(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Remove duplicate chunks, keeping the highest-scoring version.
        Deduplicates by chunk.id, content hash, and (manual_id, page_number, section)."""
        import hashlib
        seen_keys: dict[str, RetrievedChunk] = {}

        for chunk in chunks:
            norm_content = " ".join(chunk.content.strip().split()[:25]).lower()
            content_sig = hashlib.md5(norm_content.encode("utf-8", errors="ignore")).hexdigest()
            # Deduplicate by physical manual page, section, and text signature
            pos_key = f"{chunk.manual_id}_p{chunk.page_number}_{chunk.section}_{content_sig}"

            if pos_key in seen_keys:
                if chunk.similarity_score > seen_keys[pos_key].similarity_score:
                    seen_keys[pos_key] = chunk
            elif chunk.id and chunk.id in seen_keys:
                if chunk.similarity_score > seen_keys[chunk.id].similarity_score:
                    seen_keys[chunk.id] = chunk
            else:
                seen_keys[pos_key] = chunk

        return list(seen_keys.values())
