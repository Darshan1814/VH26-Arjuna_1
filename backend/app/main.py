import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.metrics import (
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION_SECONDS,
    ACTIVE_REQUESTS,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup and shutdown events."""
    setup_logging()
    logger.info("Starting Machine Troubleshooter API")
    logger.info(f"Embedding model: {settings.EMBEDDING_MODEL}")
    logger.info(f"Reranker model: {settings.RERANKER_MODEL}")
    logger.info(f"Generation model: {settings.GROQ_MODEL} (Groq Inference Engine)")

    # Models are loaded lazily on first use to keep startup fast
    yield

    logger.info("Shutting down Machine Troubleshooter API")


app = FastAPI(
    title="Machine Troubleshooter API",
    description="RAG-based machine troubleshooting with source citations & Prometheus metrics",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend from any origin (dev, k8s, EC2)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def prometheus_metrics_middleware(request: Request, call_next):
    """Automatically instruments latency, error rate, and active requests for Prometheus."""
    # Don't track the /metrics endpoint itself to avoid recursion noise
    if request.url.path == "/metrics":
        return await call_next(request)

    ACTIVE_REQUESTS.inc()
    start_time = time.time()
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        endpoint = request.url.path
        HTTP_REQUESTS_TOTAL.labels(
            method=request.method, endpoint=endpoint, status_code=response.status_code
        ).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(
            method=request.method, endpoint=endpoint
        ).observe(duration)
        return response
    except Exception as exc:
        duration = time.time() - start_time
        HTTP_REQUESTS_TOTAL.labels(
            method=request.method, endpoint=request.url.path, status_code=500
        ).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(
            method=request.method, endpoint=request.url.path
        ).observe(duration)
        raise exc
    finally:
        ACTIVE_REQUESTS.dec()


@app.get("/metrics", summary="Prometheus metrics root endpoint")
async def root_metrics():
    """Prometheus exposition metrics endpoint for scraper pods."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Register all routes
app.include_router(api_router)

