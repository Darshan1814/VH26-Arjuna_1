"""Response generation service using Azure OpenAI.

Formats retrieved document context, applies strict evidence verification,
and parses structured troubleshooting responses.
"""

import json
import logging
from typing import Optional

from openai import AzureOpenAI

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


from app.services.llm.openai_client import get_openai_client


class GenerationService:
    """Generate troubleshooting answers using configured generation model."""

    def __init__(self) -> None:
        self._llm_client = get_openai_client()

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

        try:
            parsed = self._llm_client.json_completion(messages=messages)
            logger.info(
                f"Response generated successfully. "
                f"Confidence: {parsed.get('confidence', 'N/A')}"
            )
            return parsed
        except Exception as e:
            logger.error(f"Generation API call failed: {e}")
            return {
                "answer": "Failed to format response.",
                "probable_causes": [],
                "corrective_steps": [],
                "confidence": 0.0,
            }
