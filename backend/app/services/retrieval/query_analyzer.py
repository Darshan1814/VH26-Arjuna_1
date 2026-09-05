"""Query analysis: detect error codes, machine references, and query type.

This module classifies user queries into categories so the retrieval
pipeline can apply the right strategy:

- error_code: "E101" → exact match on error_codes column
- machine_specific: "What does E101 mean on CNC-X100?" → filter by machine
- natural_language: "Why is it overheating?" → semantic search
"""

import logging
import re
from dataclasses import dataclass
from typing import Optional

from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)

# Error code patterns: E101, ERR-42, F001, A1234
ERROR_CODE_PATTERN = re.compile(r"\b([A-Z]{1,3}[-_]?\d{2,5})\b")


@dataclass
class QueryAnalysis:
    """Result of analyzing a user query."""

    original_query: str
    query_type: str  # "error_code", "machine_specific", "natural_language"
    error_codes: list[str]
    machine_id: Optional[str]
    machine_model: Optional[str]
    semantic_query: str  # Cleaned query for embedding


class QueryAnalyzer:
    """Analyze user queries to determine retrieval strategy."""

    def analyze(
        self,
        query: str,
        machine_id: Optional[str] = None,
    ) -> QueryAnalysis:
        """Analyze a query to extract error codes, machine references, and type."""
        detected_machine_model = self._detect_machine_reference(query)
        error_codes = self._extract_error_codes(query, detected_machine=detected_machine_model)

        # Determine query type
        if machine_id or detected_machine_model:
            query_type = "machine_specific"
        elif error_codes:
            query_type = "error_code"
        else:
            query_type = "natural_language"

        # Resolve machine ID from model reference if needed
        resolved_machine_id = machine_id
        if not resolved_machine_id and detected_machine_model:
            resolved_machine_id = self._resolve_machine_id(detected_machine_model)

        # Clean query for semantic search
        semantic_query = self._clean_for_semantic(query)

        analysis = QueryAnalysis(
            original_query=query,
            query_type=query_type,
            error_codes=error_codes,
            machine_id=resolved_machine_id,
            machine_model=detected_machine_model,
            semantic_query=semantic_query if semantic_query.strip() else query,
        )

        logger.info(
            f"Query analysis: type={analysis.query_type}, "
            f"error_codes={analysis.error_codes}, "
            f"machine={analysis.machine_model or analysis.machine_id}"
        )

        return analysis

    def _extract_error_codes(self, query: str, detected_machine: Optional[str] = None) -> list[str]:
        """Extract error code patterns from query, excluding machine model parts."""
        raw_codes = list(set(ERROR_CODE_PATTERN.findall(query.upper())))
        if detected_machine:
            mach_clean = detected_machine.upper().replace("-", " ")
            mach_tokens = set(mach_clean.split())
            raw_codes = [c for c in raw_codes if c not in mach_tokens and c not in detected_machine.upper()]
        return raw_codes

    def _detect_machine_reference(self, query: str) -> Optional[str]:
        """Detect machine model references in the query."""
        # 1. Match explicit phrases like "machine CNC X100" or "for machine Press-Z200"
        mach_after = re.search(r'\b(?:machine|model|system|equipment)\s+([A-Za-z0-9_\- ]{2,30})\b', query, re.IGNORECASE)
        if mach_after:
            cand = mach_after.group(1).strip()
            cand = re.sub(r'\b(error|fault|troubleshoot|code|manual)\b.*', '', cand, flags=re.IGNORECASE).strip()
            if cand and len(cand) >= 2:
                return cand.upper().replace("  ", " ")

        # 2. Match standard industrial machine identifiers like CNC-X100, PRESS-Z200, RoboArm-R5, PackPro-200
        machine_pattern = re.compile(
            r"\b([A-Za-z0-9]{2,15}[-_][A-Za-z0-9]{1,8}|(?:CNC|PRESS|LATHE|ROBOT|[A-Za-z0-9]*\d[A-Za-z0-9]*)\s+[A-Za-z0-9]*\d[A-Za-z0-9]*)\b",
            re.IGNORECASE,
        )
        matches = machine_pattern.findall(query)
        if matches:
            return matches[0].upper().replace(" ", "-")
        return None

    def _resolve_machine_id(self, model_number: str) -> Optional[str]:
        """Look up machine ID from model number in the database."""
        try:
            client = get_supabase_client()
            result = (
                client.table("machines")
                .select("id")
                .ilike("model_number", model_number)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            logger.warning(f"Could not resolve machine model {model_number}: {e}")
        return None

    def _clean_for_semantic(self, query: str) -> str:
        """Remove error codes and machine references for semantic search."""
        cleaned = ERROR_CODE_PATTERN.sub("", query)
        machine_pattern = re.compile(
            r"\b[A-Za-z0-9]{2,15}[-_][A-Za-z0-9]{1,8}\b", re.IGNORECASE
        )
        cleaned = machine_pattern.sub("", cleaned)
        # Collapse whitespace
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned
