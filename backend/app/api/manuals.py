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
        raise HTTPException(status_code=500, detail="Failed to fetch manuals")


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
