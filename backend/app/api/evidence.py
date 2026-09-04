"""API endpoint to serve generated evidence images."""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings

router = APIRouter()


@router.get("/{filename}")
async def get_evidence_image(filename: str):
    """Serve a yellow-highlighted source evidence image."""
    # Prevent path traversal
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.EVIDENCE_DIR, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Evidence image not found")

    content_type = "image/png"
    if safe_filename.lower().endswith(".jpg") or safe_filename.lower().endswith(".jpeg"):
        content_type = "image/jpeg"

    return FileResponse(file_path, media_type=content_type)
