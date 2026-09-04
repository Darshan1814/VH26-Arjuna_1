"""Grounded answer generation service enforcing strict evidence rules."""

import logging
from typing import Any, Optional

from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an Industrial Machine Troubleshooting Expert Assistant.
Your job is to provide accurate, grounded technical diagnostics and step-by-step repair guidance.

CRITICAL RULES:
1. STRICT EVIDENCE COMPLIANCE: Use ONLY the information provided in the RETRIEVED DOCUMENT CONTEXT. Do NOT invent procedures, part numbers, or tolerances from general knowledge.
2. CITATION DISCIPLINE: Every claim, diagnosis, cause, and corrective action must correspond to the manual/page/section provided.
3. INSUFFICIENT EVIDENCE REFUSAL: If the provided excerpts do not directly address the query, state clearly:
   "Insufficient information in the available sources to answer this question. I will not recommend an unsupported repair procedure."
4. SAFETY FIRST: Prominently extract and state any warnings (high voltage, pressure discharge, lockout/tagout) mentioned in the manual.
5. STRUCTURED OUTPUT: You must respond in valid JSON matching the exact schema below.

JSON Schema:
{
  "problem": "Clear statement of the detected problem / error",
  "diagnosis": "Technical explanation based strictly on manual evidence",
  "probable_causes": [
    "Cause 1 (most likely based on manual)",
    "Cause 2",
    "Cause 3"
  ],
  "recommended_solutions": [
    {
      "priority": 1,
      "action": "Action to take",
      "reason": "Why this is recommended first according to evidence",
      "evidence_strength": "Strong" | "Moderate" | "Weak",
      "source": "Manual name, Section name, Page X"
    }
  ],
  "safety_warnings": [
    "Warning text from documentation"
  ],
  "confidence_explanation": "Brief explanation of how evidence supports the answer"
}"""


class AnswerGenerationService:
    """Generates structured, grounded troubleshooting responses using OpenAI."""

    def __init__(self) -> None:
        self.client = get_openai_client()

    def generate_response(
        self,
        query: str,
        context_chunks: list[dict[str, Any]],
        machine_model: Optional[str] = None,
        detected_error_code: Optional[str] = None,
        conversation_history: Optional[list[dict[str, Any]]] = None,
    ) -> dict[str, Any]:
        """Generate structured response from assembled context chunks."""
        # Format context chunks clearly with page, manual, section
        formatted_chunks = []
        for i, chunk in enumerate(context_chunks, 1):
            formatted_chunks.append(
                f"--- EVIDENCE EXCERPT #{i} ---\n"
                f"Source Manual: {chunk.get('manual_title') or chunk.get('file_name', 'Unknown')}\n"
                f"Machine Model: {chunk.get('machine_model', 'N/A')}\n"
                f"Section: {chunk.get('section', 'General')}\n"
                f"Page: {chunk.get('page_number', 'N/A')}\n"
                f"Error Codes: {', '.join(chunk.get('error_codes', [])) or 'None'}\n"
                f"Content:\n{chunk.get('content', '')}\n"
            )

        context_text = "\n".join(formatted_chunks) if formatted_chunks else "NO EVIDENCE EXCERPTS FOUND."

        user_content = f"""RETRIEVED DOCUMENT CONTEXT:
{context_text}

TARGET MACHINE: {machine_model or 'Not explicitly specified'}
DETECTED ERROR CODE: {detected_error_code or 'None'}

USER QUERY:
{query}

Respond in strict adherence to the system instructions and output valid JSON."""

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]

        # Add recent conversation turns if applicable
        if conversation_history:
            for turn in conversation_history[-4:]:
                messages.append({
                    "role": turn.get("role", "user"),
                    "content": turn.get("content", ""),
                })

        messages.append({"role": "user", "content": user_content})

        try:
            return self.client.json_completion(messages=messages, temperature=0.1)
        except Exception as e:
            logger.error(f"Answer generation error: {e}")
            return {
                "problem": query,
                "diagnosis": "An error occurred during diagnosis generation.",
                "probable_causes": [],
                "recommended_solutions": [],
                "safety_warnings": [],
                "confidence_explanation": "Generation failed",
                "error": str(e),
            }
