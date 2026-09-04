"""Reports API router for generating, previewing, and downloading troubleshooting reports."""

import os
import uuid
import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_supabase_client
from app.core.sqlite_storage import get_sqlite_storage
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
    """Generate professional PDF and HTML reports and persist inside SQLite & Supabase."""
    report_id = str(uuid.uuid4())[:8].upper()
    sqlite_storage = get_sqlite_storage()

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
        # 1. Generate PDF in-memory (bytes)
        pdf_bytes = PDFReportGenerator.generate_bytes(payload)

        # 2. Generate HTML content string
        html_content = HTMLReportGenerator.generate(payload)

        # 3. Store in SQLite database (zero disk clutter in repo)
        sqlite_storage.save_report(
            report_data=payload,
            pdf_bytes=pdf_bytes,
            html_content=html_content,
        )

        # 4. Save record in Supabase if accessible
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
                "pdf_path": f"/api/reports/{report_id}/pdf",
                "metadata": {"report_id": report_id, "storage": "sqlite3"},
            }).execute()
            logger.info(f"Synchronized report {report_id} to Supabase reports table")
        except Exception as db_err:
            logger.warning(f"Could not persist report to Supabase (using SQLite fallback): {db_err}")

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
    """Download the generated black-and-white PDF report from SQLite storage."""
    safe_id = os.path.basename(report_id)
    sqlite_storage = get_sqlite_storage()

    # 1. Fetch binary PDF from SQLite
    pdf_bytes = sqlite_storage.get_report_pdf(safe_id)

    # 2. Fallback check for legacy file on disk if exists
    if not pdf_bytes:
        disk_pdf = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.pdf")
        if os.path.exists(disk_pdf):
            with open(disk_pdf, "rb") as pf:
                pdf_bytes = pf.read()

    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="PDF report not found in SQLite database")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=Diagnostic_Report_{safe_id}.pdf",
            "Content-Type": "application/pdf",
        },
    )


@router.get("/{report_id}/html", response_class=HTMLResponse)
async def view_html_report(report_id: str):
    """View the interactive HTML report from SQLite storage."""
    safe_id = os.path.basename(report_id)
    sqlite_storage = get_sqlite_storage()

    # 1. Fetch HTML string from SQLite
    html_content = sqlite_storage.get_report_html(safe_id)

    # 2. Fallback check for legacy file on disk if exists
    if not html_content:
        disk_html = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.html")
        if os.path.exists(disk_html):
            with open(disk_html, "r", encoding="utf-8") as hf:
                html_content = hf.read()

    if not html_content:
        raise HTTPException(status_code=404, detail="HTML report not found in SQLite database")

    return HTMLResponse(content=html_content)


@router.get("/list")
@router.get("")
async def list_reports(limit: int = 50):
    """List recent troubleshooting reports from SQLite storage."""
    sqlite_storage = get_sqlite_storage()
    return {"reports": sqlite_storage.list_reports(limit=limit)}


@router.get("/{report_id}")
async def get_report_meta(report_id: str):
    """Get metadata for a generated report from SQLite."""
    safe_id = os.path.basename(report_id)
    sqlite_storage = get_sqlite_storage()

    meta = sqlite_storage.get_report_meta(safe_id)
    if meta:
        return meta

    # Fallback to disk if legacy
    disk_pdf = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.pdf")
    disk_html = os.path.join(settings.REPORTS_DIR, f"report_{safe_id}.html")
    if os.path.exists(disk_pdf) or os.path.exists(disk_html):
        return {
            "report_id": safe_id,
            "has_pdf": os.path.exists(disk_pdf),
            "has_html": os.path.exists(disk_html),
            "pdf_url": f"/api/reports/{safe_id}/pdf",
            "html_url": f"/api/reports/{safe_id}/html",
        }

    raise HTTPException(status_code=404, detail="Report not found")
