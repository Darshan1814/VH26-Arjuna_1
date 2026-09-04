"""Cross-manual disambiguation service detecting collision between machine models."""

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class DisambiguationResult:
    """Represents outcome of machine disambiguation check."""

    def __init__(
        self,
        is_ambiguous: bool,
        candidate_machines: list[str],
        error_code: Optional[str] = None,
        clarification_message: Optional[str] = None,
    ) -> None:
        self.is_ambiguous = is_ambiguous
        self.candidate_machines = candidate_machines
        self.error_code = error_code
        self.clarification_message = clarification_message

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_ambiguous": self.is_ambiguous,
            "candidate_machines": self.candidate_machines,
            "error_code": self.error_code,
            "clarification_message": self.clarification_message,
        }


class MachineDisambiguator:
    """Identifies when an error code spans multiple machines and requires clarification."""

    @staticmethod
    def check_ambiguity(
        detected_error_codes: list[str],
        explicit_machine: Optional[str],
        retrieved_chunks: list[dict[str, Any]],
    ) -> DisambiguationResult:
        """Evaluate if retrieved evidence presents conflicting machine models for an error."""
        # If user explicitly identified the machine, no ambiguity needed
        if explicit_machine:
            return DisambiguationResult(is_ambiguous=False, candidate_machines=[explicit_machine])

        if not detected_error_codes:
            return DisambiguationResult(is_ambiguous=False, candidate_machines=[])

        # Scan chunks for which machines contain these error codes
        matched_machines: set[str] = set()
        for chunk in retrieved_chunks:
            chunk_errors = chunk.get("error_codes", [])
            chunk_machine = chunk.get("machine_model")
            if any(code in chunk_errors for code in detected_error_codes) and chunk_machine:
                matched_machines.add(chunk_machine)

        # If more than 1 distinct machine is associated with this error code
        if len(matched_machines) > 1:
            sorted_candidates = sorted(list(matched_machines))
            primary_error = detected_error_codes[0]
            message = (
                f"Error code {primary_error} was detected in service manuals for multiple machines "
                f"({', '.join(sorted_candidates)}). Please select or specify your machine model "
                f"to receive accurate, model-specific diagnostics."
            )
            logger.info(f"Cross-manual ambiguity detected for {primary_error}: {sorted_candidates}")
            return DisambiguationResult(
                is_ambiguous=True,
                candidate_machines=sorted_candidates,
                error_code=primary_error,
                clarification_message=message,
            )

        return DisambiguationResult(
            is_ambiguous=False,
            candidate_machines=list(matched_machines),
            error_code=detected_error_codes[0] if detected_error_codes else None,
        )

    def evaluate(
        self,
        query: str,
        detected_error_code: Optional[str] = None,
        detected_machine: Optional[str] = None,
        candidate_chunks: Optional[list[dict[str, Any]]] = None,
    ) -> DisambiguationResult:
        """Helper evaluate interface matching multi-agent caller patterns."""
        error_codes = [detected_error_code] if detected_error_code else []
        chunks = candidate_chunks or []
        return self.check_ambiguity(
            detected_error_codes=error_codes,
            explicit_machine=detected_machine,
            retrieved_chunks=chunks,
        )

