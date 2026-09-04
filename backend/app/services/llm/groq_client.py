"""Groq LLM client for generating troubleshooting responses.

Sends assembled context + strict system prompt to Groq and parses
the structured response. The prompt explicitly restricts the LLM
to only use retrieved evidence.
"""

import json
import logging
from typing import Optional

from groq import Groq

from app.core.config import settings
from app.services.llm.prompt_templates import (
    build_system_prompt,
    build_user_prompt,
)
from app.services.retrieval.hybrid_retriever import RetrievedChunk

logger = logging.getLogger(__name__)


class GroqClient:
    """Generate troubleshooting answers using Groq LLM."""

    def __init__(self) -> None:
        self._client: Optional[Groq] = None

    @property
    def client(self) -> Groq:
        """Lazy-initialize the Groq client."""
        if self._client is None:
            if not settings.GROQ_API_KEY:
                raise ValueError(
                    "GROQ_API_KEY is not set. "
                    "Get your key from https://console.groq.com/keys"
                )
            self._client = Groq(api_key=settings.GROQ_API_KEY)
            logger.info(f"Groq client initialized (model: {settings.GROQ_MODEL})")
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

        # Add conversation history if available
        if conversation_history:
            for msg in conversation_history[-6:]:  # Last 6 messages for context
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        messages.append({"role": "user", "content": user_prompt})

        try:
            response = self.client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                temperature=0.1,  # Low temperature for factual answers
                max_tokens=2048,
                response_format={"type": "json_object"},
            )

            response_text = response.choices[0].message.content
            parsed = json.loads(response_text)

            logger.info(
                f"Groq response generated. "
                f"Confidence: {parsed.get('confidence', 'N/A')}"
            )

            return parsed

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq JSON response: {e}")
            return {
                "answer": response_text if 'response_text' in dir() else "Failed to generate response.",
                "probable_causes": [],
                "corrective_steps": [],
                "confidence": 0.0,
            }
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")
            raise
