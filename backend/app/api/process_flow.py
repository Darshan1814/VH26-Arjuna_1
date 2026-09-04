"""Process Flow API router managing the 16-step industrial diagnostic workflow."""

import logging
from typing import Any, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.process_flow_manager import get_flow_manager

router = APIRouter()
logger = logging.getLogger(__name__)


class StepExecutionRequest(BaseModel):
    user_input: Optional[dict[str, Any]] = None


@router.post("/upload")
async def upload_flow_files(
    files: list[UploadFile] = File(...),
    session_id: Optional[str] = Form(None),
):
    """Upload files into a specific process flow session."""
    flow_mgr = get_flow_manager()
    session = flow_mgr.get_or_create_session(session_id)
    sid = session.session_id

    uploaded_files = []
    for f in files:
        content = await f.read()
        filename = f.filename or "uploaded_file"
        meta = flow_mgr.add_file(sid, filename, content)
        uploaded_files.append(meta)

    return {
        "status": "success",
        "session_id": sid,
        "files_count": len(session.files),
        "files": uploaded_files,
    }


@router.post("/{session_id}/step/{step_num}")
async def execute_step(
    session_id: str,
    step_num: int,
    body: Optional[StepExecutionRequest] = None,
):
    """Execute a single step (1-16) within the specified process flow session."""
    if step_num < 1 or step_num > 16:
        raise HTTPException(status_code=400, detail="Step number must be between 1 and 16")

    flow_mgr = get_flow_manager()
    input_data = body.user_input if body and body.user_input else {}

    try:
        telemetry = await flow_mgr.execute_step(session_id, step_num, input_data)
        return {
            "status": "success",
            "session_id": session_id,
            "step": step_num,
            "telemetry": telemetry,
        }
    except Exception as e:
        logger.error(f"Error executing step {step_num} for session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to execute step {step_num}: {str(e)}")


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get the current state and step execution history for a session."""
    flow_mgr = get_flow_manager()
    session = flow_mgr.get_or_create_session(session_id)

    return {
        "session_id": session.session_id,
        "current_step": session.current_step,
        "files": [{"name": f["name"], "size": f["size"]} for f in session.files],
        "step_data": session.step_data,
        "query": session.query,
        "selected_machine": session.selected_machine,
        "report_id": session.report_id,
        "final_result": session.final_result,
        "status": session.status,
    }


@router.post("/{session_id}/restart")
async def restart_session(session_id: str):
    """Restart a workflow session back to step 1."""
    flow_mgr = get_flow_manager()
    session = flow_mgr.get_or_create_session(session_id)
    session.current_step = 1
    session.step_data = {}
    session.final_result = None
    session.report_id = None
    return {"status": "success", "session_id": session_id, "current_step": 1}
