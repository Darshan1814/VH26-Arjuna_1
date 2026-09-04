"""Query understanding and intent analysis service using OpenAI."""

import logging
import re
from typing import Any, Optional

from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)

# Common regex pattern for machine error codes (e.g., E101, ERR-402, ALARM 12)
ERROR_CODE_REGEX = re.compile(
    r"\b(?:E-?\d{2,4}|ERR-?\d{2,4}|ALARM\s*\d{1,4}|FAULT\s*\d{1,4}|CODE\s*[A-Z0-9-]+)\b",
    re.IGNORECASE,
)

# Common machine model patterns (e.g., CNC-X100, PRESS-Z200, LATHE-500)
MACHINE_MODEL_REGEX = re.compile(
    r"\b(?:CNC-[A-Z0-9]+|PRESS-[A-Z0-9]+|LATHE-[A-Z0-9]+|ROBOT-[A-Z0-9]+|[A-Z]{2,5}-\d{2,4}[A-Z]?)\b",
    re.IGNORECASE,
)


class QueryAnalysisService:
    """Extracts intent, error codes, and machine references from user queries."""

    def __init__(self) -> None:
        self.client = get_openai_client()

    def analyze(
        self,
        query: str,
        conversation_context: Optional[list[dict]] = None,
        context_machine_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Deep analysis of query with fallback regex and conversation history."""
        # Quick regex heuristics
        regex_errors = [c.upper().replace(" ", "") for c in ERROR_CODE_REGEX.findall(query)]
        regex_machines = [m.upper() for m in MACHINE_MODEL_REGEX.findall(query)]

        # Contextual history summary if available
        history_summary = ""
        if conversation_context:
            history_summary = "\n".join(
                [f"{msg.get('role')}: {msg.get('content')}" for msg in conversation_context[-4:]]
            )

        # Fast path for direct exact error queries (e.g. "E101", "What does E101 mean") to avoid rate limit spikes
        if regex_errors and len(query.strip().split()) <= 4 and not history_summary:
            return {
                "query": query,
                "machine_model": regex_machines[0] if regex_machines else context_machine_id,
                "error_codes": regex_errors,
                "symptoms": [],
                "specifications": [],
                "needs_clarification": False,
                "clarification_questions": [],
                "intent": "troubleshoot",
                "language": "en",
                "is_followup": False,
            }

        prompt = f"""You are a query analysis module in an industrial troubleshooting system.
Analyze the user's latest message considering previous conversation context.

Conversation History:
{history_summary or "None"}

Current User Query:
"{query}"

Detect and extract:
1. "machine_model": specific machine mentioned now or established in history (e.g. "CNC-X100"). null if unknown.
2. "error_codes": array of exact error/fault codes (e.g. ["E101"]).
3. "symptoms": array of physical or behavioral symptoms (e.g. ["overheating", "chattering noise", "खड़खड़ाहट"]).
4. "specifications": array of all extracted numbers, electrical ratings, and units (e.g. ["7.5 kW", "240V", "415V", "14.00 A", "4-5 seconds", "10 HP"]).
5. "needs_clarification": boolean. True if the query is vague, missing critical details (e.g. which motor is failing, whether idler started, exact error message), or requires further input before safe diagnosis.
6. "clarification_questions": array of 1-3 targeted questions to ask the user in the SAME language as the query (e.g. Hindi if query is in Hindi) to narrow down the fault safely.
7. "intent": "troubleshoot", "clarification", "followup", "general_question", or "status_check".
8. "language": language code (e.g. "hi", "en", "ja", "de").
9. "is_followup": boolean, whether the query refers back to previously discussed machine/error.

Respond ONLY in valid JSON:
{{
  "machine_model": string or null,
  "error_codes": [string],
  "symptoms": [string],
  "specifications": [string],
  "needs_clarification": boolean,
  "clarification_questions": [string],
  "intent": string,
  "language": string,
  "is_followup": boolean
}}"""
        try:
            result = self.client.json_completion([{"role": "user", "content": prompt}])
            # Merge with regex for precision
            detected_codes = list(set(result.get("error_codes", []) + regex_errors))
            detected_machine = result.get("machine_model") or (regex_machines[0] if regex_machines else None)

            # Heuristic number extraction if LLM missed any
            specs = result.get("specifications", [])
            num_pattern = re.compile(r"\b\d+(?:\.\d+)?\s*(?:kw|hp|v|a|amp|amps|hz|rpm|sec|seconds|सेकंड|किलोवाट|वोल्ट|एम्पीयर)?\b", re.IGNORECASE)
            for m in num_pattern.findall(query):
                if m.strip() and m.strip() not in specs and len(m.strip()) > 1:
                    specs.append(m.strip())

            return {
                "query": query,
                "machine_model": detected_machine,
                "error_codes": detected_codes,
                "symptoms": result.get("symptoms", []),
                "specifications": specs,
                "needs_clarification": result.get("needs_clarification", False),
                "clarification_questions": result.get("clarification_questions", []),
                "intent": result.get("intent", "troubleshoot"),
                "language": result.get("language", "en"),
                "is_followup": result.get("is_followup", False),
            }
        except Exception as e:
            logger.warning(f"LLM query analysis failed, using heuristic: {e}")
            return {
                "query": query,
                "machine_model": regex_machines[0] if regex_machines else None,
                "error_codes": regex_errors,
                "symptoms": [],
                "specifications": [],
                "needs_clarification": False,
                "clarification_questions": [],
                "intent": "troubleshoot",
                "language": "en",
                "is_followup": False,
            }
