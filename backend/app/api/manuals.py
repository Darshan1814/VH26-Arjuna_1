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
async def get_manual_suggestions(manual_id: Optional[str] = None):
    """Return dynamic diagnostic suggestions without forcing any pre-selected manual."""
    import os
    manual_names = []
    if os.path.exists(settings.MANUALS_DIR):
        manual_names = [
            f for f in os.listdir(settings.MANUALS_DIR)
            if not f.startswith(".") and f.lower().endswith((".pdf", ".txt", ".docx"))
        ]

    suggestions = [
        "What are the primary troubleshooting steps for motor starting failure?",
        "How do I inspect electrical input voltage, balance, and earthing?",
        "What safety precautions must be followed before servicing control cabinets?",
        "How to identify root causes for abnormal vibration or overheating?",
        "How to troubleshoot servo drive overcurrent or ground faults?",
    ]

    return {
        "status": "success",
        "manuals_count": len(manual_names),
        "active_manual": None,
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

    import os
    manual_id = str(uuid.uuid4())
    filename = file.filename or f"manual_{manual_id}.pdf"

    try:
        # 1. Read file content and persist to local attached volume / disk
        content = await file.read()
        os.makedirs(settings.MANUALS_DIR, exist_ok=True)
        disk_path = os.path.join(settings.MANUALS_DIR, filename)
        with open(disk_path, "wb") as f:
            f.write(content)
        logger.info(f"Saved uploaded manual to disk at {disk_path} ({len(content)} bytes)")

        # 2. Record manual in local SQLite storage
        try:
            from app.core.sqlite_storage import get_sqlite_storage
            get_sqlite_storage().save_document(
                doc_id=manual_id,
                filename=filename,
                title=title,
                file_bytes=content,
                content_type="application/pdf",
                machine_model=machine_id,
            )
            logger.info(f"Saved manual {title} to SQLite storage")
        except Exception as sql_err:
            logger.warning(f"Could not persist manual to SQLite: {sql_err}")

        # 3. Optionally sync to Supabase if configured
        storage_path = None
        try:
            client = get_supabase_client()
            if client:
                storage_path = f"{machine_id}/{manual_id}/{filename}"
                try:
                    bucket = get_storage_bucket()
                    bucket.upload(storage_path, content, {"content-type": "application/pdf"})
                except Exception as e:
                    logger.warning(f"Supabase storage upload failed: {e}")
                    storage_path = None

                manual_data = {
                    "id": manual_id,
                    "machine_id": machine_id,
                    "title": title,
                    "filename": filename,
                    "storage_path": storage_path,
                    "status": "uploaded",
                }
                client.table("manuals").insert(manual_data).execute()
        except Exception as supa_err:
            logger.info(f"Supabase sync skipped/deferred (running with local volume storage): {supa_err}")

        return ManualUploadResponse(
            id=manual_id,
            machine_id=machine_id,
            title=title,
            filename=filename,
            status="uploaded",
            message="Manual uploaded successfully and stored on persistent storage.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload manual: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload manual: {str(e)}")
