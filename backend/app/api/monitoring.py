"""Monitoring API endpoints for Prometheus, Grafana, and CI/CD reporting."""

import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Response, Request
from pydantic import BaseModel
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.core.metrics import (
    SONARQUBE_QUALITY_GATE_STATUS,
    TRIVY_VULNERABILITIES_COUNT,
    PIPELINE_BUILD_STATUS,
    KUBERNETES_POD_HEALTH,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class PipelineReportPayload(BaseModel):
    pipeline_name: str = "Arjuna_1"
    stage_name: str
    status: str  # SUCCESS, FAILED, RUNNING
    sonarqube_status: Optional[str] = "OK"  # OK, WARN, ERROR
    trivy_critical: Optional[int] = 0
    trivy_high: Optional[int] = 0
    details: Optional[Dict[str, Any]] = None


@router.get("/metrics", summary="Prometheus metrics exposition endpoint")
async def get_metrics():
    """Returns all aggregated Prometheus metrics in official exposition format."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.post("/pipeline-event", summary="Report CI/CD pipeline event to Prometheus")
async def report_pipeline_event(payload: PipelineReportPayload):
    """Called by Jenkins pipeline to push stage status, SonarQube, and Trivy scan stats into Grafana/Prometheus."""
    is_success = 1.0 if payload.status.upper() == "SUCCESS" else 0.0
    PIPELINE_BUILD_STATUS.labels(pipeline=payload.pipeline_name, stage=payload.stage_name).set(is_success)

    if payload.sonarqube_status:
        sonar_score = 1.0 if payload.sonarqube_status.upper() in ["OK", "PASSED"] else 0.0
        SONARQUBE_QUALITY_GATE_STATUS.labels(project=payload.pipeline_name).set(sonar_score)

    if payload.trivy_critical is not None:
        TRIVY_VULNERABILITIES_COUNT.labels(target="container_images", severity="CRITICAL").set(payload.trivy_critical)
    if payload.trivy_high is not None:
        TRIVY_VULNERABILITIES_COUNT.labels(target="container_images", severity="HIGH").set(payload.trivy_high)

    logger.info(f"Reported CI/CD event: {payload.stage_name} = {payload.status}")
    return {"status": "recorded", "payload": payload}


@router.get("/overview", summary="Summary stats for Grafana and frontend")
async def get_monitoring_overview():
    """Provides high-level system monitoring health."""
    return {
        "system": "Industrial Machine Troubleshooting System",
        "status": "HEALTHY",
        "monitoring": {
            "prometheus": "ENABLED",
            "grafana": "ENABLED",
            "metrics_endpoint": "/metrics",
        },
        "integrations": {
            "sonarqube": "CONNECTED",
            "trivy": "ACTIVE",
            "kubernetes_hpa": "ACTIVE",
        },
    }
