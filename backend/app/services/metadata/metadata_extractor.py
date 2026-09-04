"""Metadata extraction service combining high-speed regex with LLM intelligence."""

import re
from typing import Any

from app.services.llm.query_analysis import ERROR_CODE_REGEX, MACHINE_MODEL_REGEX

DATE_REGEX = re.compile(r"\b(?:\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b")


class MetadataExtractor:
    """Extracts machine models, error codes, dates, and warning markers from text."""

    @staticmethod
    def extract(text: str, file_name: str = "") -> dict[str, Any]:
        """Extract metadata attributes from given content string."""
        # Find error codes
        found_codes = [c.upper().replace(" ", "") for c in ERROR_CODE_REGEX.findall(text)]
        # Also check file name for error code
        file_codes = [c.upper().replace(" ", "") for c in ERROR_CODE_REGEX.findall(file_name)]
        all_codes = sorted(list(set(found_codes + file_codes)))

        # Find machine models
        found_machines = [m.upper() for m in MACHINE_MODEL_REGEX.findall(text)]
        file_machines = [m.upper() for m in MACHINE_MODEL_REGEX.findall(file_name)]
        all_machines = sorted(list(set(found_machines + file_machines)))

        # Find dates
        dates = sorted(list(set(DATE_REGEX.findall(text))))

        # Detect safety warning indicators
        warning_markers = ["WARNING", "CAUTION", "DANGER", "SAFETY NOTICE", "GEFAHR", "ACHTUNG"]
        has_warnings = any(marker in text.upper() for marker in warning_markers)

        return {
            "error_codes": all_codes,
            "machine_models": all_machines,
            "dates": dates,
            "has_warnings": has_warnings,
            "primary_machine": all_machines[0] if all_machines else None,
            "primary_error_code": all_codes[0] if all_codes else None,
        }
