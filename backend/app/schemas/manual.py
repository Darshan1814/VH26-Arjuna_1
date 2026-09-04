"""Manual schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ManualResponse(BaseModel):
    id: str
    machine_id: str
    title: str
    filename: str
    storage_path: Optional[str] = None
    total_pages: Optional[int] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ManualUploadResponse(BaseModel):
    id: str
    machine_id: str
    title: str
    filename: str
    status: str
    message: str
