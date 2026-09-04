"""Response generation service using Azure OpenAI.

Formats retrieved document context, applies strict evidence verification,
and parses structured troubleshooting responses.
"""

import json
import logging
from typing import Optional, Any

from app.core.config import settings
from app.services.retrieval.hybrid_retriever import RetrievedChunk

logger = logging.getLogger(__name__)


def build_system_prompt() -> str:
    """Build the system prompt that restricts generation to retrieved evidence."""
    return """You are a machine troubleshooting assistant. You help engineers diagnose and fix machine problems using ONLY the information from provided service manuals.

CRITICAL RULES:
1. ONLY use information from the provided document chunks below. Do NOT use your general knowledge.
2. If the provided chunks do not contain enough information to answer, say so clearly. Do NOT guess or invent procedures.
3. Always cite which manual, section, and page your answer comes from.
4. If an error code appears in multiple machine manuals with different meanings, clearly state which machine you are answering for.
5. Provide structured troubleshooting steps when applicable.
6. Be precise about safety warnings and procedures from the manuals.

You MUST respond in valid JSON format with the following structure:
{
    "answer": "Your detailed troubleshooting answer based on the manual evidence",
    "probable_causes": ["cause 1", "cause 2"],
    "corrective_steps": ["step 1", "step 2", "step 3"],
    "confidence": 0.0 to 1.0 based on how well the evidence supports your answer,
    "safety_warnings": ["any safety warnings from the manual"]
}

If you cannot find relevant information in the provided chunks:
{
    "answer": "I could not find sufficient evidence in the available manuals to answer this question. I will not recommend a repair based on unsupported information.",
    "probable_causes": [],
    "corrective_steps": [],
    "confidence": 0.0,
    "safety_warnings": []
}"""


def build_user_prompt(
    query: str,
    chunks: list[RetrievedChunk],
) -> str:
    """Build the user prompt with the query and retrieved context."""
    context_parts: list[str] = []

    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"--- Document Chunk {i} ---\n"
            f"Manual: {chunk.manual_title or chunk.manual_id}\n"
            f"Machine: {chunk.machine_model or chunk.machine_id}\n"
            f"Section: {chunk.section}\n"
            f"Page: {chunk.page_number}\n"
            f"Error Codes: {', '.join(chunk.error_codes) if chunk.error_codes else 'None'}\n"
            f"Content:\n{chunk.content}\n"
        )

    context = "\n".join(context_parts)

    if not context_parts:
        context = "NO RELEVANT DOCUMENT CHUNKS WERE FOUND. You must indicate that you have insufficient information."

    return f"""RETRIEVED DOCUMENT CONTEXT:
{context}

USER QUESTION: {query}

Based ONLY on the document context above, provide a structured troubleshooting response in JSON format."""


def build_what_if_system_prompt() -> str:
    """Build the system prompt for Evidence-Based What-If Analysis."""
    return """You are an expert machine troubleshooting assistant specializing in Evidence-Based What-If Analysis.
You evaluate hypothetical troubleshooting scenarios strictly grounded in retrieved machine service manuals, current conversation context, and machine state.

SAFETY & EVIDENCE INTEGRITY PRINCIPLES:
1. Grounding: Rely strictly on the provided manual chunks. DO NOT fabricate sensor values, damage timeframes (e.g. "in 10 minutes"), exact temperatures, or damage probabilities unless explicitly stated in the manuals.
2. Outcome Classification: Explicitly distinguish between:
   - "documented_facts": Direct statements and consequences explicitly written in the manual.
   - "reasoned_inferences": Logical inferences derived from current condition and manual facts (always worded as possibilities or deductions, never absolute certainty).
   - "unknowns": Gaps or specifics not provided in the manuals (e.g., exact time until component failure, unverified intermediate states).
3. Never Present Speculation as Fact: Avoid "will definitely fail"; say "The available documentation does not specify how quickly failure would occur" or "Continued operation may increase thermal stress."
4. Potentially Unsafe Operation: If an action involves unsafe operation (such as bypassing a safety switch or ignoring an active critical alarm), include a safety warning: "Do not perform this action unless it is authorized by the machine's safety procedure."
5. Action Comparison: Compare options objectively based on invasiveness, requirement for defect confirmation, and manual guidance.
6. Branching: If a component is assumed working, clearly reprioritize diagnostic checks to the next documented causes.
7. Next Steps: When a fix fails or is contemplated, identify the next documented troubleshooting step.

You MUST respond in valid JSON format with this exact structure:
{
    "scenario_type": "continue_operation | test_fix | fix_failed | action_comparison | branching | skip_step | general",
    "current_situation": {
        "machine": "Machine model if known",
        "error_code": "Error code if known",
        "condition": "Current condition / symptoms"
    },
    "hypothetical_action": "Concise statement of the hypothetical action",
    "possible_outcome": "Concise summary of the potential consequences or effects",
    "why": "Explanation citing the manual's causal logic or evidence",
    "documented_facts": ["Fact 1 with citation context", "Fact 2"],
    "reasoned_inferences": ["Inference 1 clearly stated as an inference", "Inference 2"],
    "unknowns": ["Item not specified by manual (e.g., exact failure time not specified)"],
    "recommended_action": "Documented recommended action or procedure",
    "safety_warning": "Safety notice if action is hazardous, or null",
    "timeline": ["Step 1: Current condition", "Step 2: Hypothetical action", "Step 3: Documented consequence", "Step 4: Verification"],
    "comparison_table": [
        {
            "action": "Action name",
            "relevance": "Why and when relevant",
            "intervention_level": "e.g. Lower intervention / Component replacement",
            "manual_supported": true,
            "notes": "Context"
        }
    ],
    "confidence": 0.0 to 1.0
}"""


def build_what_if_user_prompt(
    query: str,
    chunks: list[RetrievedChunk],
    state_context: dict,
    scenario_type: str,
) -> str:
    """Build the user prompt for What-If scenario analysis."""
    context_parts: list[str] = []

    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"--- Document Chunk {i} ---\n"
            f"Manual: {chunk.manual_title or chunk.manual_id}\n"
            f"Machine: {chunk.machine_model or chunk.machine_id}\n"
            f"Section: {chunk.section}\n"
            f"Page: {chunk.page_number}\n"
            f"Error Codes: {', '.join(chunk.error_codes) if chunk.error_codes else 'None'}\n"
            f"Content:\n{chunk.content}\n"
        )

    context = "\n".join(context_parts) if context_parts else "NO RELEVANT DOCUMENT CHUNKS WERE FOUND."

    state_str = json.dumps(state_context, indent=2)

    return f"""CURRENT TROUBLESHOOTING CONTEXT & MACHINE STATE:
{state_str}

IDENTIFIED WHAT-IF SCENARIO TYPE:
{scenario_type}

RETRIEVED SERVICE MANUAL EVIDENCE:
{context}

USER WHAT-IF QUESTION:
{query}

Analyze this hypothetical question against the current state and manual evidence. Return a strict JSON response following the requested schema."""


def _clean_json_text(text: str) -> str:
    """Strip markdown code fence wrappers from JSON output if present."""
    stripped = text.strip()
    if stripped.startswith("```json"):
        stripped = stripped[7:]
    elif stripped.startswith("```"):
        stripped = stripped[3:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


class GenerationService:
    """Generate troubleshooting answers using configured generation model."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None

    @property
    def client(self) -> Any:
        """Lazy-initialize Azure OpenAI client."""
        if self._client is None:
            if not settings.AZURE_OPENAI_KEY or not settings.AZURE_OPENAI_ENDPOINT:
                raise ValueError(
                    "AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT must be configured in environment variables."
                )

            try:
                from openai import AzureOpenAI
            except ImportError:
                raise ImportError(
                    "openai package is required for generation. Please install with: pip install openai"
                )

            self._client = AzureOpenAI(
                azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                api_key=settings.AZURE_OPENAI_KEY,
                api_version=settings.AZURE_OPENAI_VERSION,
            )
            deployment = settings.AZURE_OPENAI_DEPLOYMENT or settings.MODEL_GEN
            logger.info(f"Generation service initialized (deployment: {deployment})")
        return self._client

    async def generate(
        self,
        query: str,
        context_chunks: list[RetrievedChunk],
        conversation_history: Optional[list[dict]] = None,
    ) -> dict:
        """Generate a structured troubleshooting response.

        Args:
            query: The user's question.
            context_chunks: Retrieved and reranked document chunks.
            conversation_history: Previous messages for context continuity.

        Returns:
            Parsed response dict with answer, causes, steps, confidence.
        """
        system_prompt = build_system_prompt()
        user_prompt = build_user_prompt(query, context_chunks)

        messages = [{"role": "system", "content": system_prompt}]

        if conversation_history:
            for msg in conversation_history[-6:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        messages.append({"role": "user", "content": user_prompt})

        deployment = settings.AZURE_OPENAI_DEPLOYMENT or settings.MODEL_GEN

        try:
            response = self.client.chat.completions.create(
                model=deployment,
                messages=messages,
                response_format={"type": "json_object"},
            )

            response_text = response.choices[0].message.content or "{}"
            cleaned_text = _clean_json_text(response_text)
            parsed = json.loads(cleaned_text)

            logger.info(
                f"Response generated successfully. "
                f"Confidence: {parsed.get('confidence', 'N/A')}"
            )

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse generation JSON response: {e}")
            return {
                "answer": response_text if 'response_text' in locals() and response_text else "Failed to format response.",
                "probable_causes": [],
                "corrective_steps": [],
                "confidence": 0.0,
            }
        except Exception as e:
            logger.error(f"Generation API call failed: {e}")
            raise

    async def generate_what_if(
        self,
        query: str,
        context_chunks: list[RetrievedChunk],
        state_context: dict,
        scenario_type: str = "general",
        conversation_history: Optional[list[dict]] = None,
    ) -> dict:
        """Generate an Evidence-Based What-If Analysis response.

        Args:
            query: User's hypothetical question.
            context_chunks: Retrieved chunks from service manuals.
            state_context: Structured troubleshooting state (machine, error, checks).
            scenario_type: Classified scenario type.
            conversation_history: Recent conversation messages.

        Returns:
            Structured dictionary parsed from model response.
        """
        system_prompt = build_what_if_system_prompt()
        user_prompt = build_what_if_user_prompt(
            query=query,
            chunks=context_chunks,
            state_context=state_context,
            scenario_type=scenario_type,
        )

        messages = [{"role": "system", "content": system_prompt}]

        if conversation_history:
            for msg in conversation_history[-6:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        messages.append({"role": "user", "content": user_prompt})

        deployment = settings.AZURE_OPENAI_DEPLOYMENT or settings.MODEL_GEN

        try:
            response = self.client.chat.completions.create(
                model=deployment,
                messages=messages,
                response_format={"type": "json_object"},
            )

            response_text = response.choices[0].message.content or "{}"
            cleaned_text = _clean_json_text(response_text)
            parsed = json.loads(cleaned_text)

            logger.info(
                f"What-If response generated successfully. "
                f"Scenario: {parsed.get('scenario_type', scenario_type)}"
            )

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse What-If JSON response: {e}")
            return {
                "scenario_type": scenario_type,
                "current_situation": state_context,
                "hypothetical_action": query,
                "possible_outcome": "Unable to structure response cleanly.",
                "why": "Response parsing error.",
                "documented_facts": [],
                "reasoned_inferences": [],
                "unknowns": ["The available manual does not specify enough details to complete this parse."],
                "confidence": 0.0,
            }
        except Exception as e:
            logger.error(f"What-If Generation API call failed: {e}")
            raise
