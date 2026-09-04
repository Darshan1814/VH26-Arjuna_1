"""Central API router that aggregates all route modules."""

from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.machines import router as machines_router
from app.api.manuals import router as manuals_router
from app.api.rag import router as rag_router
from app.api.conversations import router as conversations_router
from app.api.translate import router as translate_router
from app.api.upload import router as upload_router
from app.api.process_flow import router as process_flow_router
from app.api.reports import router as reports_router
from app.api.evidence import router as evidence_router

api_router = APIRouter()

# Health check at root level
api_router.include_router(health_router)

# All feature routes under /api
api_router.include_router(machines_router, prefix="/api/machines", tags=["machines"])
api_router.include_router(manuals_router, prefix="/api/manuals", tags=["manuals"])
api_router.include_router(rag_router, prefix="/api/rag", tags=["rag"])
api_router.include_router(conversations_router, prefix="/api/conversations", tags=["conversations"])
api_router.include_router(translate_router, prefix="/api/translate", tags=["translate"])
api_router.include_router(upload_router, prefix="/api/upload", tags=["upload"])
api_router.include_router(process_flow_router, prefix="/api/process-flow", tags=["process-flow"])
api_router.include_router(reports_router, prefix="/api/reports", tags=["reports"])
api_router.include_router(evidence_router, prefix="/api/evidence", tags=["evidence"])

