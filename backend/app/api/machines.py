"""Machine management endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.core.database import get_supabase_client
from app.schemas.machine import MachineCreate, MachineResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=list[MachineResponse])
async def list_machines():
    """List all registered machines."""
    try:
        client = get_supabase_client()
        result = client.table("machines").select("*").order("name").execute()
        return result.data
    except Exception as e:
        logger.warning(f"Supabase unavailable ({e}), returning default registered machines for local development")
        return [
            MachineResponse(
                id="00000000-0000-0000-0000-000000000001",
                name="Industrial Drive Controller",
                model_number="IDC-5000",
                manufacturer="Apex Automation",
                category="Power Conversion & Drives",
                description="Heavy-duty electronic variable speed and power drive controller",
            ),
            MachineResponse(
                id="00000000-0000-0000-0000-000000000002",
                name="Haas CNC Vertical Mill",
                model_number="VF-2",
                manufacturer="Haas Automation",
                category="Machining",
                description="CNC vertical machining center with high-speed spindle",
            ),
        ]


@router.get("/{machine_id}", response_model=MachineResponse)
async def get_machine(machine_id: str):
    """Get a specific machine by ID."""
    try:
        client = get_supabase_client()
        result = (
            client.table("machines")
            .select("*")
            .eq("id", machine_id)
            .single()
            .execute()
        )
        return result.data
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:
        logger.error(f"Failed to fetch machine {machine_id}: {e}")
        raise HTTPException(status_code=404, detail="Machine not found")


@router.post("", response_model=MachineResponse, status_code=201)
async def create_machine(machine: MachineCreate):
    """Register a new machine."""
    try:
        client = get_supabase_client()
        result = (
            client.table("machines")
            .insert(machine.model_dump())
            .execute()
        )
        return result.data[0]
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:
        logger.error(f"Failed to create machine: {e}")
        raise HTTPException(status_code=500, detail="Failed to create machine")
