"""RAG query endpoint — the core troubleshooting interface."""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.query import RAGQueryRequest
from app.schemas.rag_response import RAGResponse
from app.rag.pipeline import RAGPipeline

router = APIRouter()
logger = logging.getLogger(__name__)

# Singleton pipeline instance (lazy-loaded)
_pipeline: RAGPipeline | None = None


def get_pipeline() -> RAGPipeline:
    """Get or create the RAG pipeline singleton."""
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline


@router.post("/query", response_model=RAGResponse)
async def rag_query(request: RAGQueryRequest):
    """Process a troubleshooting query through the RAG pipeline.

    Flow:
    1. Analyze query (detect error codes, machine references)
    2. Retrieve relevant document chunks (hybrid search)
    3. Rerank results
    4. Check retrieval confidence
    5. Generate answer with Groq LLM
    6. Build citations
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        pipeline = get_pipeline()
        response = await pipeline.process_query(request)
        return response
    except Exception as e:
        logger.error(f"RAG pipeline error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your query. Please try again.",
        )
