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
    
    # Check manuals directory
    manual_names = []
    if os.path.exists(settings.MANUALS_DIR):
        manual_names = [f for f in os.listdir(settings.MANUALS_DIR) if not f.startswith(".") and f.endswith(".pdf")]

    has_phasemaker = any("phase" in f.lower() or "maker" in f.lower() or "converter" in f.lower() for f in manual_names)

    if has_phasemaker or not manual_names:
        suggestions = [
            "Why is the load motor making a chattering noise on the PhaseMaker Rotary Converter?",
            "How to turn ON the Rotary Converter for RC10 and larger models?",
            "What size PhaseMaker RC model is required for a 7.5 kW motor?",
            "How to connect the Soft Starter to U1, V1, W1 on the load motor?",
            "What should I do if the Idler motor does not run after 4-5 seconds of pressing START?",
        ]
    else:
        first_manual = manual_names[0].replace(".pdf", "").replace("_", " ")
        suggestions = [
            f"What are the primary troubleshooting procedures in {first_manual}?",
            f"How do I verify starting circuit voltage and current for {first_manual}?",
            f"What safety precautions must be followed before servicing {first_manual}?",
            f"What are the recommended operating conditions for {first_manual}?",
        ]

    return {
        "status": "success",
        "manuals_count": len(manual_names),
        "active_manual": manual_names[0] if manual_names else "PhaseMaker Rotary Converter Manual",
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
