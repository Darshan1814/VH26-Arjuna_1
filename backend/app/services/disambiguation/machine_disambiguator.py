"""Cross-manual disambiguation service detecting collision between machine models."""

import logging
from typing import Any, Optional

import os
import re
import json
from app.core.config import settings

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
        query: str = "",
    ) -> DisambiguationResult:
        """Evaluate if retrieved evidence presents conflicting machine models for an error or symptom."""
        # If user explicitly identified the machine in query, no ambiguity needed
        if explicit_machine and explicit_machine.lower() not in ["universal", "industrial equipment", "general machinery"]:
            if query and explicit_machine.lower() in query.lower():
                return DisambiguationResult(is_ambiguous=False, candidate_machines=[explicit_machine])

        matched_machines: dict[str, int] = {}

        for chunk in retrieved_chunks:
            chunk_errors = [str(c).lower() for c in chunk.get("error_codes", [])]
            content_lower = (str(chunk.get("content", "")) + " " + str(chunk.get("heading", ""))).lower()

            # Resolve candidate machine/manual name across all possible metadata fields
            candidates = [
                chunk.get("machine_model"),
                chunk.get("machine"),
                chunk.get("metadata", {}).get("machine_model") if isinstance(chunk.get("metadata"), dict) else None,
                chunk.get("manual_title"),
                chunk.get("manual_id"),
                chunk.get("metadata", {}).get("file_name") if isinstance(chunk.get("metadata"), dict) else None,
                chunk.get("file_name"),
            ]
            machine = None
            for cand in candidates:
                if cand:
                    cand_str = str(cand).strip()
                    cand_clean = re.sub(r'^[a-f0-9]{8}[-_]', '', cand_str)
                    cand_clean = re.sub(r'\.(pdf|txt|docx|png|jpg|csv|log)$', '', cand_clean, flags=re.IGNORECASE)
                    cand_clean = cand_clean.replace('_', ' ').replace('-', ' ').strip()
                    if cand_clean and cand_clean.lower() not in [
                        "universal", "general", "none", "unknown", "manual", "technical service manual"
                    ] and not cand_clean.isdigit():
                        machine = cand_clean.title()
                        break

            if not machine:
                continue

            # Check if this machine's manual references the error code or high relevance inquiry
            has_error_match = False
            if detected_error_codes:
                for code in detected_error_codes:
                    c_clean = code.strip().lower()
                    if c_clean and (any(c_clean in ce for ce in chunk_errors) or c_clean in content_lower):
                        has_error_match = True
                        break
            else:
                score = float(chunk.get("similarity_score") or chunk.get("rerank_score") or 0.0)
                if score > 0.30:
                    has_error_match = True
                elif query:
                    q_words = [w.lower() for w in query.split() if len(w) > 3]
                    if any(w in content_lower for w in q_words):
                        has_error_match = True

            if has_error_match:
                matched_machines[machine] = matched_machines.get(machine, 0) + 1

        # Also inspect cached chunks on disk if detected_error_codes are present
        if detected_error_codes and os.path.exists(settings.MANUALS_DIR):
            for fname in os.listdir(settings.MANUALS_DIR):
                if fname.endswith(".chunks.json"):
                    base_m = fname.replace(".chunks.json", "")
                    cand_name = re.sub(r'^[a-f0-9]{8}[-_]', '', base_m)
                    cand_name = re.sub(r'\.(pdf|txt|docx)$', '', cand_name, flags=re.IGNORECASE).replace('_', ' ').replace('-', ' ').strip().title()
                    if not cand_name or cand_name.lower() in ["universal", "general", "unknown"] or cand_name.isdigit():
                        cand_name = ""
                    try:
                        with open(os.path.join(settings.MANUALS_DIR, fname), "r", encoding="utf-8") as cf:
                            c_data = json.load(cf)
                        for c in c_data:
                            c_m = (c.get("machine_model") or c.get("machine") or cand_name or "").strip().title()
                            if not c_m or c_m.isdigit() or c_m.lower() in ["universal", "general", "unknown", "manual"]:
                                continue
                            c_errs = [str(x).lower() for x in c.get("error_codes", [])]
                            c_text = (c.get("content", "") + " " + c.get("section", "")).lower()
                            for code in detected_error_codes:
                                if code.lower() in c_errs or code.lower() in c_text:
                                    matched_machines[c_m] = matched_machines.get(c_m, 0) + 1
                                    break
                    except Exception:
                        pass

        # Clean and deduplicate candidate machine names that share the same root
        raw_names = list(matched_machines.keys())
        cleaned_candidates: list[str] = []
        for name in raw_names:
            if not name or name.isdigit() or len(name) <= 1:
                continue
            c = re.sub(r'\b(Service|Hydraulic|Technical|General|Operation|Operator|Milling|Center|Heavy|Stamping)?\s*Manual\b', '', name, flags=re.IGNORECASE).strip()
            c = re.sub(r'\b(Milling Center|Hydraulic Press|Service Manual|Hydraulic Manual)\b', '', c, flags=re.IGNORECASE).strip()
            c = c.replace(" ", "-")
            c = re.sub(r'-+', '-', c).strip("-").upper()
            if not c or c.isdigit():
                continue
            if not any(c == existing.upper() or c in existing.upper() or existing.upper() in c for existing in cleaned_candidates):
                cleaned_candidates.append(c)

        # If more than 1 distinct machine is associated with this error code/symptom
        if len(cleaned_candidates) > 1:
            sorted_candidates = sorted(cleaned_candidates)
            primary_error = detected_error_codes[0] if detected_error_codes else "this symptom"
            message = (
                f"We noticed that {primary_error} is present in multiple service manuals "
                f"({', '.join(sorted_candidates)}). Which machine or system are you troubleshooting?"
            )
            logger.info(f"Cross-manual ambiguity detected for {primary_error}: {sorted_candidates}")
            return DisambiguationResult(
                is_ambiguous=True,
                candidate_machines=sorted_candidates,
                error_code=detected_error_codes[0] if detected_error_codes else None,
                clarification_message=message,
            )

        return DisambiguationResult(
            is_ambiguous=False,
            candidate_machines=list(matched_machines.keys()),
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
            query=query,
        )
