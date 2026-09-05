"""Arjuna Sarthi Browser Extension API.

Provides grounded question answering over fetched webpage content using Groq LLM inference.
Enforces strict grounding: if information is not found in the fetched page context,
the model responds that it could not find that information rather than hallucinating.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.llm.openai_client import get_openai_client

logger = logging.getLogger(__name__)

router = APIRouter()


class ContentChunk(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    heading: Optional[str] = None
    section: Optional[str] = None
    content: str
    url: Optional[str] = None


class ConversationTurn(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class AskRequest(BaseModel):
    url: str
    title: str
    question: str
    context: List[ContentChunk] = Field(
        default_factory=list,
        description="Relevant structured content chunks extracted from the active webpage",
    )
    conversation: List[ConversationTurn] = Field(
        default_factory=list,
        description="Previous conversation turns for context continuity on this page",
    )


class SourceCitation(BaseModel):
    title: Optional[str] = None
    heading: Optional[str] = None
    section: Optional[str] = None
    url: Optional[str] = None
    snippet: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    sources: List[SourceCitation] = Field(default_factory=list)
    model: str
    grounded: bool


class ExtensionHealthResponse(BaseModel):
    status: str
    model: str
    groq_configured: bool
    version: str = "1.0.0"


@router.get("/health", response_model=ExtensionHealthResponse)
async def extension_health():
    """Health check and model capability probe for Arjuna Sarthi extension."""
    has_key = bool(settings.GROQ_API_KEY)
    model_name = settings.GROQ_MODEL or "qwen/qwen3.8-27b"
    return ExtensionHealthResponse(
        status="ready" if has_key else "degraded",
        model=model_name,
        groq_configured=has_key,
        version="1.0.0",
    )


@router.post("/ask", response_model=AskResponse)
async def ask_webpage_question(payload: AskRequest):
    """Answers user queries grounded strictly in the fetched webpage context.

    Uses Groq LLM inference via the centralized client with fallback models.
    """
    if not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    # 1. Format the page context for the prompt
    context_blocks: List[str] = []
    sources: List[SourceCitation] = []

    for idx, chunk in enumerate(payload.context, 1):
        heading_label = chunk.heading or chunk.section or f"Section {idx}"
        snippet_preview = chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
        sources.append(
            SourceCitation(
                title=chunk.title or payload.title,
                heading=heading_label,
                section=chunk.section,
                url=chunk.url or payload.url,
                snippet=snippet_preview,
            )
        )
        context_blocks.append(
            f"--- [CHUNK {idx}] Section: {heading_label} ---\n{chunk.content}"
        )

    joined_context = "\n\n".join(context_blocks) if context_blocks else "No page context provided."

    # 2. Build system instructions for Arjuna Sarthi
    system_prompt = (
        "You are 'Arjuna Sarthi' — an elite, high-precision AI companion for understanding the web.\n\n"
        "YOUR CORE MISSION:\n"
        "Provide factual, highly accurate, and grounded answers strictly based on the fetched webpage context provided below.\n\n"
        "CRITICAL RULES FOR FACTUAL GROUNDING:\n"
        "1. Base your answer ONLY on the provided webpage content.\n"
        "2. If the user's question asks for facts, data, details, or figures NOT mentioned or inferable from the fetched page, "
        "YOU MUST EXPLICITLY STATE:\n"
        "   \"I couldn't find that information in the fetched page.\"\n"
        "   Do NOT use external training knowledge or speculate when the information is absent.\n"
        "3. When answering, cite the relevant section or heading from the context (e.g. 'According to the [Section Name] section...').\n"
        "4. Be direct, clear, well-structured, and concise. Use bullet points or numbered lists where appropriate.\n"
        "5. Support follow-up questions by considering the conversation history, but keep answers anchored to the webpage content.\n\n"
        f"WEBPAGE METADATA:\n"
        f"- Title: {payload.title}\n"
        f"- URL: {payload.url}\n\n"
        f"FETCHED PAGE CONTENT:\n"
        f"{joined_context}"
    )

    # 3. Assemble chat messages with conversation history
    messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]

    # Include recent conversation turns (up to last 6 for conversational context)
    recent_history = payload.conversation[-6:] if payload.conversation else []
    for turn in recent_history:
        if turn.role in ["user", "assistant"]:
            messages.append({"role": turn.role, "content": turn.content})

    # Add the current question
    messages.append({"role": "user", "content": payload.question})

    # 4. Invoke Groq via centralized client
    try:
        llm = get_openai_client()
        raw_answer = llm.chat_completion(
            messages=messages,
            temperature=0.1,  # Low temperature for strict factual adherence
            max_tokens=1500,
        )

        answer_text = raw_answer.strip()
        # Check if the answer indicates missing information
        grounded = "couldn't find that information" not in answer_text.lower() and "could not find that information" not in answer_text.lower()

        return AskResponse(
            answer=answer_text,
            sources=sources[:5],  # Top 5 most relevant sources
            model=llm.model_name,
            grounded=grounded,
        )

    except Exception as exc:
        logger.error(f"Arjuna Sarthi extension error invoking Groq: {exc}", exc_info=True)
        # Check if it's a rate limit or service error
        error_msg = str(exc)
        if "rate_limit" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Groq service rate limit reached. Please wait a moment and retry.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service inference error: {error_msg}",
        )
