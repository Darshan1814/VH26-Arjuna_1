"""Central API router that aggregates all route modules."""

from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.machines import router as machines_router
from app.api.manuals import router as manuals_router
from app.api.rag import router as rag_router
from app.api.conversations import router as conversations_router

api_router = APIRouter()

# Health check at root level
api_router.include_router(health_router)

# All feature routes under /api
api_router.include_router(machines_router, prefix="/api/machines", tags=["machines"])
api_router.include_router(manuals_router, prefix="/api/manuals", tags=["manuals"])
api_router.include_router(rag_router, prefix="/api/rag", tags=["rag"])
api_router.include_router(
    conversations_router, prefix="/api/conversations", tags=["conversations"]
)
