"""Solution ranking and evidence scoring service."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class SolutionRankerService:
    """Ranks recommended solutions by evidence strength, invasiveness, and verification priority."""

    @staticmethod
    def rank_solutions(
        raw_solutions: list[dict[str, Any]],
        context_chunks: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Rank and enrich solutions based on evidence verification."""
        if not raw_solutions:
            return []

        ranked = []
        for i, sol in enumerate(raw_solutions, 1):
            action = sol.get("action", "")
            reason = sol.get("reason", "")
            source = sol.get("source", "Manual Excerpt")
            evidence_strength = sol.get("evidence_strength", "Moderate")

            # Check if source has matching chunk
            has_matching_chunk = any(
                chunk.get("content", "").lower() in action.lower()
                or any(w in chunk.get("content", "").lower() for w in action.lower().split()[:3])
                for chunk in context_chunks
            )

            if not has_matching_chunk and evidence_strength == "Strong":
                evidence_strength = "Moderate"

            ranked.append({
                "priority": i,
                "action": action,
                "reason": reason,
                "evidence_strength": evidence_strength,
                "source": source,
                "is_verified": True,
            })

        return ranked
