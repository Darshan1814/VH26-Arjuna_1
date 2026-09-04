"""Automated API endpoint tests using FastAPI TestClient."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Verify /health returns 200 and healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data


def test_rag_query_validation():
    """Verify empty query returns 400."""
    response = client.post("/api/rag/query", json={"query": "   "})
    assert response.status_code == 400


def test_process_flow_lifecycle():
    """Verify process flow upload and step execution."""
    # Test uploading a file to a new session
    files = [("files", ("test_manual.txt", b"Machine: CNC-X100\nError E101: Spindle motor overheat\nCheck fan filter.", "text/plain"))]
    upload_res = client.post("/api/process-flow/upload", files=files)
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert upload_data["status"] == "success"
    session_id = upload_data["session_id"]
    assert session_id is not None

    # Test executing Step 1: Input Collection
    step1_res = client.post(f"/api/process-flow/{session_id}/step/1")
    assert step1_res.status_code == 200
    step1_data = step1_res.json()
    assert step1_data["telemetry"]["step"] == 1
    assert step1_data["telemetry"]["total_files"] >= 1

    # Test executing Step 2: Language & File Detection
    step2_res = client.post(f"/api/process-flow/{session_id}/step/2")
    assert step2_res.status_code == 200
    step2_data = step2_res.json()
    assert step2_data["telemetry"]["step"] == 2
    assert len(step2_data["telemetry"]["detected_items"]) >= 1

    # Test session state retrieval
    state_res = client.get(f"/api/process-flow/{session_id}")
    assert state_res.status_code == 200
    state_data = state_res.json()
    assert state_data["session_id"] == session_id


def test_reports_api_generation_and_download():
    """Verify report generation and downloading."""
    report_req = {
        "query": "E101 Spindle thermal trip",
        "machine_model": "CNC-X100",
        "error_code": "E101",
        "problem": "Spindle motor temperature high",
        "diagnosis": "Cooling fan filter obstructed",
        "probable_causes": ["Clogged fan filter"],
        "recommended_solutions": [
            {
                "priority": 1,
                "action": "Clean filter with compressed air",
                "reason": "Restores airflow",
                "evidence_strength": "Strong",
                "source": "Manual p. 42",
            }
        ],
        "safety_warnings": ["Power off before servicing"],
        "confidence_level": "HIGH",
        "confidence": 0.95,
        "evidence_images": [],
    }

    gen_res = client.post("/api/reports/generate", json=report_req)
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    report_id = gen_data["report_id"]
    assert report_id is not None

    # Test PDF download
    pdf_res = client.get(f"/api/reports/{report_id}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"

    # Test HTML view
    html_res = client.get(f"/api/reports/{report_id}/html")
    assert html_res.status_code == 200
    assert "CNC-X100" in html_res.text
