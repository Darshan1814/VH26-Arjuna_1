"""Signal-based confidence score calculation service."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class ConfidenceEvaluation:
    """Calculated confidence score with qualitative level and reasoning."""

    def __init__(
        self,
        score: float,
        level: str,  # "HIGH", "MEDIUM", "LOW"
        reasons: list[str],
    ) -> None:
        self.score = round(score, 2)
        self.level = level
        self.reasons = reasons

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "level": self.level,
            "reasons": self.reasons,
        }


class ConfidenceEvaluator:
    """Computes grounding confidence from retrieval and metadata signals."""

    @staticmethod
    def evaluate(
        has_exact_error_match: bool,
        has_machine_match: bool,
        top_similarity_score: float,
        top_rerank_score: float,
        source_count: int,
        is_ambiguous: bool,
    ) -> ConfidenceEvaluation:
        """Compute score from 0.0 to 1.0 based on structural evidence."""
        score = 0.0
        reasons = []

        if is_ambiguous:
            return ConfidenceEvaluation(
                score=0.45,
                level="MEDIUM",
                reasons=["Cross-manual ambiguity detected across multiple models."],
            )

        # Signal 1: Exact error code match (up to +0.35)
        if has_exact_error_match:
            score += 0.35
            reasons.append("Exact error code match in official documentation (+35%).")
        else:
            reasons.append("No exact error code match found.")

        # Signal 2: Machine model match (up to +0.25)
        if has_machine_match:
            score += 0.25
            reasons.append("Explicit machine model verified in manual (+25%).")
        else:
            reasons.append("Machine model was inferred or unspecified.")

        # Signal 3: Reranker score (up to +0.25)
        if top_rerank_score > 0.7:
            score += 0.25
            reasons.append("High neural cross-encoder agreement (+25%).")
        elif top_rerank_score > 0.4:
            score += 0.15
            reasons.append("Moderate neural cross-encoder agreement (+15%).")
        else:
            reasons.append("Low neural reranking confidence.")

        # Signal 4: Source consensus (up to +0.15)
        if source_count >= 2:
            score += 0.15
            reasons.append(f"Multiple supporting source sections ({source_count} found) (+15%).")
        elif source_count == 1:
            score += 0.08
            reasons.append("Single supporting source section (+8%).")

        score = min(max(score, 0.0), 1.0)

        if score >= 0.75:
            level = "HIGH"
        elif score >= 0.45:
            level = "MEDIUM"
        else:
            level = "LOW"

        return ConfidenceEvaluation(score=score, level=level, reasons=reasons)
