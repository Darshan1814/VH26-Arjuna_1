"""Grounded answer generation service enforcing strict evidence rules."""

import logging
from typing import Any, Optional

from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)

MASTER_SYSTEM_PROMPT = """You are the backend reasoning engine for a RAG-based Machine Troubleshooting System (hackathon PS: Application Data Management — RAG).

STRICT SCOPE RULES:
- Only use information retrieved from the provided manual chunks/context. Never use outside knowledge about the equipment.
- Never invent a page number, section number, or manual name. If metadata is missing, say "not specified in source."
- If retrieved evidence has low similarity/confidence, or no evidence exists, respond with an explicit "Insufficient information" result — never guess a plausible-sounding fix.
- If the same error code appears in multiple manuals/machines, do not silently pick one — flag it as an ambiguity case.
- Do not perform any task outside troubleshooting diagnosis, evidence verification, or the specific pipeline stage you are asked to run. Do not chit-chat, do not answer general knowledge questions, do not proceed to a later pipeline stage than the one requested.
- Format every output as short explanatory bullet points, not paragraphs. Each bullet should be a complete, standalone fact or step.
- Every claim must carry a source tag: (Document, Section, Page).

OUTPUT FORMAT (always):
- Return valid JSON matching the schema given for this stage. No prose outside the JSON.

JSON Schema:
{
  "problem": "Clear statement of the detected problem / error",
  "diagnosis": "Detailed technical explanation structured in points based strictly on manual evidence",
  "probable_causes": [
    "Cause 1 (detailed point with technical reason from manual)",
    "Cause 2 (detailed point with technical reason from manual)"
  ],
  "recommended_solutions": [
    {
      "priority": 1,
      "action": "Detailed step-by-step action to take (with specific tools, values, or checks) — Source: Manual, Section, Page",
      "reason": "Why this is recommended first according to evidence",
      "evidence_strength": "Strong" | "Moderate" | "Weak",
      "source": "Manual name, Section name, Page X"
    }
  ],
  "safety_warnings": [
    "Precise safety warning text from documentation (verbatim WARNING/CAUTION/DANGER)"
  ],
  "confidence_explanation": "Brief explanation of how evidence supports the answer",
  "clarifying_question": null or "string if ambiguity detected",
  "insufficient_info": false
}"""


class AnswerGenerationService:
    """Generates structured, grounded troubleshooting responses using Groq Llama-3.3-70b / OpenAI."""

    def __init__(self) -> None:
        self.client = get_openai_client()

    def generate_response(
        self,
        query: str,
        context_chunks: list[dict[str, Any]],
        machine_model: Optional[str] = None,
        detected_error_code: Optional[str] = None,
        conversation_history: Optional[list[dict[str, Any]]] = None,
        applied_steps: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Generate structured response from assembled context chunks with What-If escalation support."""
        # Detect What-If simulator escalation query
        is_what_if = any(p in query.lower() for p in [
            "what if that doesn't", "what if that does not", "didn't work", "did not work",
            "still not working", "tried that", "already tried", "next step", "escalat"
        ])

        # Extract previously applied steps from history if not explicitly provided
        prior_steps = list(applied_steps or [])
        if not prior_steps and conversation_history:
            for turn in conversation_history:
                if turn.get("role") == "assistant":
                    content = turn.get("content", "")
                    if "Step" in content or "action" in content.lower():
                        prior_steps.append(content[:100])

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

        if is_what_if and prior_steps:
            user_content = f"""RETRIEVED DOCUMENT CONTEXT:
{context_text}

TARGET MACHINE: {machine_model or 'Not explicitly specified'}
DETECTED ERROR CODE: {detected_error_code or 'None'}

TASK: "WHAT-IF" SIMULATOR FOLLOW-UP ESCALATION
The user already tried these steps and it did NOT fix the issue:
{chr(10).join(f'- {s}' for s in prior_steps)}

Rule:
Using ONLY the same manual's remaining relevant sections, propose the next escalation step.
If no further documented steps exist in the excerpts, say so explicitly:
"CAUTION: contact company's technical support. All standard manual-prescribed field procedures have been exhausted."

USER QUERY:
{query}

Respond in valid JSON following the schema and include:
"escalation_level": int (starting at 2),
"previous_steps_excluded": {json.dumps(prior_steps[:5])}"""
        else:
            user_content = f"""RETRIEVED DOCUMENT CONTEXT:
{context_text}

TARGET MACHINE: {machine_model or 'Not explicitly specified'}
DETECTED ERROR CODE: {detected_error_code or 'None'}

USER QUERY:
{query}

Respond in strict adherence to the Master System Rules and output valid JSON."""

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": MASTER_SYSTEM_PROMPT},
        ]

        if conversation_history:
            for turn in conversation_history[-4:]:
                messages.append({
                    "role": turn.get("role", "user"),
                    "content": turn.get("content", ""),
                })

        messages.append({"role": "user", "content": user_content})

        try:
            # Use Playbook verified Llama-3.3-70b-versatile for diagnosis reasoning
            from app.core.config import settings
            model = settings.GROQ_REASONING_MODEL if settings.GROQ_API_KEY else None
            return self.client.json_completion(messages=messages, temperature=0.1, model=model)
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
