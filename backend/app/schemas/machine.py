"""Machine schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MachineCreate(BaseModel):
    name: str
    model_number: str
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class MachineResponse(BaseModel):
    id: str
    name: str
    model_number: str
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
