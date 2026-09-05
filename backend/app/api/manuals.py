"""Manual management and upload endpoints."""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.database import get_supabase_client, get_storage_bucket
from app.schemas.manual import ManualResponse, ManualUploadResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=list[ManualResponse])
async def list_manuals(machine_id: Optional[str] = None):
    """List all manuals, optionally filtered by machine."""
    try:
        client = get_supabase_client()
        query = client.table("manuals").select("*").order("created_at", desc=True)
        if machine_id:
            query = query.eq("machine_id", machine_id)
        result = query.execute()
        return result.data
    except ValueError:
        logger.warning("Supabase not configured, returning empty manual list")
        return []
    except Exception as e:
        logger.error(f"Failed to fetch manuals: {e}")
        return []


@router.get("/suggestions")
async def get_manual_suggestions():
    """Return dynamic diagnostic suggestions derived from uploaded manuals."""
    import os
    suggestions = []
    
    # Check SQLite storage and manuals directory
    manual_names = []
    try:
        from app.core.sqlite_storage import get_sqlite_storage
        docs = get_sqlite_storage().list_documents()
        for d in docs:
            fn = d.get("filename")
            if fn and fn not in manual_names:
                manual_names.append(fn)
    except Exception as e:
        logger.warning(f"Could not query SQLite documents: {e}")

    if os.path.exists(settings.MANUALS_DIR):
        for f in os.listdir(settings.MANUALS_DIR):
            if not f.startswith(".") and f.lower().endswith((".pdf", ".txt", ".docx", ".csv", ".log")) and f not in manual_names:
                manual_names.append(f)

    if manual_names:
        first_manual = manual_names[0]
        # Clean prefix and extensions
        clean_name = first_manual
        for prefix in ["FLOW-XULLQP_", "FLOW-"]:
            if clean_name.startswith(prefix):
                clean_name = clean_name[len(prefix):]
        for ext in [".pdf", ".txt", ".docx", ".csv", ".log"]:
            if clean_name.lower().endswith(ext):
                clean_name = clean_name[:-len(ext)]
        clean_name = clean_name.replace("_", " ").replace("-", " ").strip()

        suggestions = [
            f"What are the primary troubleshooting procedures in {clean_name}?",
            f"How do I verify starting circuit voltage and power supply for {clean_name}?",
            f"What safety precautions must be followed before servicing {clean_name}?",
            f"What are the recommended operating specifications for {clean_name}?",
            f"How to diagnose error codes and failure symptoms in {clean_name}?",
        ]
        active_title = f"{clean_name} Manual"
    else:
        active_title = "Standard Equipment Manual"
        suggestions = [
            "What are the primary troubleshooting procedures for this equipment?",
            "How do I verify starting circuit voltage and power supply?",
            "What safety precautions must be followed before servicing?",
            "What are the recommended operating specifications?",
        ]

    return {
        "status": "success",
        "manuals_count": len(manual_names),
        "active_manual": active_title,
        "suggestions": suggestions,
    }


@router.post("/upload", response_model=ManualUploadResponse, status_code=201)
async def upload_manual(
    file: UploadFile = File(...),
    machine_id: str = Form(...),
    title: str = Form(...),
):
    """Upload a PDF manual for processing.

    Steps:
    1. Validate the file is a PDF
    2. Upload to Supabase Storage
    3. Create a manual record in the database
    4. (Future) Trigger async ingestion pipeline
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    try:
        client = get_supabase_client()
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Read file content
        content = await file.read()
        manual_id = str(uuid.uuid4())
        storage_path = f"{machine_id}/{manual_id}/{file.filename}"

        # Upload to Supabase Storage
        try:
            bucket = get_storage_bucket()
            bucket.upload(storage_path, content, {"content-type": "application/pdf"})
        except Exception as e:
            logger.warning(f"Storage upload failed (may not be configured): {e}")
            storage_path = None

        # Create manual record
        manual_data = {
            "id": manual_id,
            "machine_id": machine_id,
            "title": title,
            "filename": file.filename,
            "storage_path": storage_path,
            "status": "uploaded",  # uploaded → processing → ready → error
        }

        result = client.table("manuals").insert(manual_data).execute()

        logger.info(f"Manual uploaded: {title} (id={manual_id})")

        return ManualUploadResponse(
            id=manual_id,
            machine_id=machine_id,
            title=title,
            filename=file.filename,
            status="uploaded",
            message="Manual uploaded successfully. Ingestion pipeline will process it.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload manual: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload manual: {str(e)}")
