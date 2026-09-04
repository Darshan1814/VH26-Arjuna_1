"""Reports API router for generating, previewing, and downloading troubleshooting reports."""

import os
import uuid
import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.reports.pdf_generator import PDFReportGenerator
from app.services.reports.html_generator import HTMLReportGenerator

router = APIRouter()
logger = logging.getLogger(__name__)


class GenerateReportRequest(BaseModel):
    query: str
    machine_model: Optional[str] = "Industrial Machine"
    error_code: Optional[str] = None
    problem: Optional[str] = None
    diagnosis: Optional[str] = None
    probable_causes: list[str] = []
    recommended_solutions: list[dict[str, Any]] = []
    safety_warnings: list[str] = []
    confidence_level: Optional[str] = "HIGH"
    confidence: Optional[float] = 0.9
    evidence_images: list[dict[str, Any]] = []


@router.post("/generate")
async def generate_report(request: GenerateReportRequest):
    """Generate professional PDF and HTML reports from diagnosis results."""
    report_id = str(uuid.uuid4())[:8].upper()
    filename = f"report_{report_id}.pdf"
    html_filename = f"report_{report_id}.html"

    payload = {
        "report_id": report_id,
        "query": request.query,
        "machine_model": request.machine_model or "Universal Machine",
        "error_code": request.error_code,
        "problem": request.problem or request.query,
        "diagnosis": request.diagnosis or "",
        "probable_causes": request.probable_causes,
        "recommended_solutions": request.recommended_solutions,
        "safety_warnings": request.safety_warnings,
        "confidence_level": request.confidence_level or "HIGH",
        "confidence": request.confidence or 0.9,
        "evidence_images": request.evidence_images,
    }

    try:
        # Generate PDF
        pdf_path = PDFReportGenerator.generate(payload, filename)

        # Generate HTML
        html_content = HTMLReportGenerator.generate(payload)
        html_path = os.path.join(settings.REPORTS_DIR, html_filename)
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        # Save record in Supabase if reachable
        try:
            client = get_supabase_client()
            client.table("reports").insert({
                "title": f"Diagnostic Report - {request.machine_model} {request.error_code or ''}".strip(),
                "query": request.query,
                "machine_model": request.machine_model,
                "error_code": request.error_code,
                "diagnosis": request.diagnosis,
                "probable_causes": request.probable_causes,
                "recommended_solutions": request.recommended_solutions,
                "confidence": request.confidence,
                "confidence_level": request.confidence_level,
                "evidence": request.evidence_images,
                "html_content": html_content,
                "pdf_path": pdf_path,
                "metadata": {"report_id": report_id},
            }).execute()
        except Exception as db_err:
            logger.warning(f"Could not persist report to database: {db_err}")

        return {
            "status": "success",
            "report_id": report_id,
            "pdf_url": f"/api/reports/{report_id}/pdf",
            "html_url": f"/api/reports/{report_id}/html",
            "download_url": f"/api/reports/{report_id}/pdf",
        }

    except Exception as e:
        logger.error(f"Failed to generate report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/{report_id}/pdf")
async def download_pdf_report(report_id: str):
    """Download the generated black-and-white PDF report."""
    safe_id = os.path.basename(report_id)
    pdf_path = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.pdf")

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF report not found")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Diagnostic_Report_{safe_id}.pdf",
    )


@router.get("/{report_id}/html", response_class=HTMLResponse)
async def view_html_report(report_id: str):
    """View the interactive HTML report."""
    safe_id = os.path.basename(report_id)
    html_path = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.html")

    if not os.path.exists(html_path):
        raise HTTPException(status_code=404, detail="HTML report not found")

    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    return HTMLResponse(content=content)


@router.get("/{report_id}")
async def get_report_meta(report_id: str):
    """Get metadata for a generated report."""
    safe_id = os.path.basename(report_id)
    pdf_path = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.pdf")
    html_path = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.html")

    if not os.path.exists(pdf_path) and not os.path.exists(html_path):
        raise HTTPException(status_code=404, detail="Report not found")

    return {
        "report_id": safe_id,
        "has_pdf": os.path.exists(pdf_path),
        "has_html": os.path.exists(html_path),
        "pdf_url": f"/api/reports/{safe_id}/pdf",
        "html_url": f"/api/reports/{safe_id}/html",
    }
