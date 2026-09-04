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
    logger.info(f"Reranker model: {settings.RERANKER_MODEL}")
    logger.info(f"Generation model: {settings.AZURE_OPENAI_DEPLOYMENT or settings.MODEL_GEN}")

    # Models are loaded lazily on first use to keep startup fast
    yield

    logger.info("Shutting down Machine Troubleshooter API")


app = FastAPI(
    title="Machine Troubleshooter API",
    description="RAG-based machine troubleshooting with source citations",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
if settings.CORS_ORIGINS == "*":
    cors_origins = ["*"]
else:
    cors_origins = [
        origin.strip()
        for origin in settings.CORS_ORIGINS.split(",")
        if origin.strip()
    ]
    # Ensure standard local origins are always permitted
    for default_origin in ["http://localhost:3000", "http://mt-frontend:3000"]:
        if default_origin not in cors_origins:
            cors_origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routes
app.include_router(api_router)
