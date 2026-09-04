"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup and shutdown events."""
    setup_logging()
    logger.info("Starting Machine Troubleshooter API")
    logger.info(f"Embedding model: {settings.EMBEDDING_MODEL}")
    gen_model = settings.GROQ_MODEL if settings.GROQ_API_KEY else (settings.AZURE_OPENAI_DEPLOYMENT or settings.MODEL_GEN)
    logger.info(f"Generation model: {gen_model} ({'Groq' if settings.GROQ_API_KEY else 'Azure/OpenAI'})")

    # Models are loaded lazily on first use to keep startup fast
    yield

    logger.info("Shutting down Machine Troubleshooter API")


app = FastAPI(
    title="Machine Troubleshooter API",
    description="RAG-based machine troubleshooting with source citations",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://mt-frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routes
app.include_router(api_router)
