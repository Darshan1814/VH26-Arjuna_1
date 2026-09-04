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

        prompt = f"""You are a query analysis module in an industrial troubleshooting system.
Analyze the user's latest message considering previous conversation context.

Conversation History:
{history_summary or "None"}

Current User Query:
"{query}"

Detect and extract:
1. "machine_model": specific machine mentioned now or established in history (e.g. "CNC-X100"). null if unknown.
2. "error_codes": array of exact error/fault codes (e.g. ["E101"]).
3. "symptoms": array of physical or behavioral symptoms (e.g. ["overheating", "spindle grinding noise"]).
4. "intent": "troubleshoot", "clarification", "followup", "general_question", or "status_check".
5. "language": language code (e.g. "en", "ja", "de").
6. "is_followup": boolean, whether the query refers back to previously discussed machine/error.

Respond ONLY in valid JSON:
{{
  "machine_model": string or null,
  "error_codes": [string],
  "symptoms": [string],
  "intent": string,
  "language": string,
  "is_followup": boolean
}}"""
        try:
            result = self.client.json_completion([{"role": "user", "content": prompt}])
            # Merge with regex for precision
            detected_codes = list(set(result.get("error_codes", []) + regex_errors))
            detected_machine = result.get("machine_model") or (regex_machines[0] if regex_machines else None)

            return {
                "query": query,
                "machine_model": detected_machine,
                "error_codes": detected_codes,
                "symptoms": result.get("symptoms", []),
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
                "intent": "troubleshoot",
                "language": "en",
                "is_followup": False,
            }
