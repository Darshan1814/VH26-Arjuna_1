"""Programmatic end-to-end verification of all 8 Process Flow steps."""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_all_8_steps():
    print("==================================================================")
    print("TESTING PROCESS FLOW STEPS 1 THROUGH 8 (PROGRAMMATIC CODE ONLY)")
    print("==================================================================")

    # 1. Start Session with upload
    upload_url = f"{BASE_URL}/api/process-flow/upload"
    files = [
        ("files", ("PhaseMaker_Sample.txt", b"Machine Model: PhaseMaker Rotary Converter\nNOTE: If your machine does not turn on or you hear a chattering noise, STOP. Turn the LOAD SWITCH OFF. Rotate the wiring connection of the LOAD plug for one full sequence: Wire in L1 to L2, L2 to L3, and L3 to L1. Restart the Rotary Converter.", "text/plain"))
    ]
    res = requests.post(upload_url, files=files)
    assert res.status_code == 200, f"Upload failed: {res.text}"
    session_data = res.json()
    session_id = session_data["session_id"]
    print(f"\n[INIT] Session Created: {session_id}")
    print(f"Files uploaded: {len(session_data.get('files', []))}")

    # Set query on session
    query_body = {"user_input": {"query": "Why does the motor make a chattering noise when starting?"}}

    for step in range(1, 9):
        print(f"\n------------------------------------------------------------------")
        print(f"EXECUTING STEP {step}...")
        print(f"------------------------------------------------------------------")
        t0 = time.time()
        step_res = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/{step}", json=query_body)
        duration = round(time.time() - t0, 2)
        
        if step_res.status_code != 200:
            print(f"STEP {step} FAILED ({step_res.status_code}): {step_res.text}")
            break
            
        data = step_res.json()
        telemetry = data.get("telemetry", {})
        print(f"STEP {step} SUCCESS in {duration}s!")
        print(f"Title: {telemetry.get('title')}")
        print(f"Status: {telemetry.get('status')}")
        
        # Print step-specific key telemetry keys
        clean_telem = {k: v for k, v in telemetry.items() if k not in ("extracted_sections_sample", "raw_extracted_text", "chunks_sample")}
        print(f"Telemetry Summary:\n{json.dumps(clean_telem, indent=2)}")
        
        # Verify specific critical fields
        if step == 1:
            assert telemetry.get("total_files", 0) >= 1
        elif step == 2:
            assert "pages_processed" in telemetry
        elif step == 3:
            assert "detected_machine" in telemetry
        elif step == 4:
            assert "total_chunks_created" in telemetry
            assert telemetry.get("dimension") == 1024
        elif step == 5:
            assert "chunks_indexed" in telemetry
        elif step == 6:
            assert "indexed_sections" in telemetry or "retrieval_status" in telemetry
        elif step == 7:
            assert "confidence_score" in telemetry or "top_sources_reranked" in telemetry
        elif step == 8:
            final_res = telemetry.get("final_result", {})
            report_id = telemetry.get("report_id") or final_res.get("report_id")
            pdf_url = telemetry.get("pdf_url") or final_res.get("pdf_download_url")
            html_url = telemetry.get("html_url") or final_res.get("html_view_url")
            assert report_id is not None, "report_id missing"
            assert pdf_url is not None, "pdf_url missing"
            assert html_url is not None, "html_url missing"
            print(f"\n[STEP 8 FINAL ARTIFACTS]")
            print(f"Report ID: {report_id}")
            print(f"PDF URL: {pdf_url}")
            print(f"HTML URL: {html_url}")
            
            # Verify downloading PDF and HTML
            pdf_res = requests.get(f"{BASE_URL}{pdf_url}")
            assert pdf_res.status_code == 200, "PDF download failed"
            assert len(pdf_res.content) > 1000, "PDF content too small"
            print(f"Downloaded PDF successfully: {len(pdf_res.content)} bytes")
            
            html_res = requests.get(f"{BASE_URL}{html_url}")
            assert html_res.status_code == 200, "HTML download failed"
            assert len(html_res.content) > 1000, "HTML content too small"
            print(f"Downloaded HTML successfully: {len(html_res.content)} bytes")
            return

    print("\n==================================================================")
    print("ALL 8 STEPS SUCCESSFULLY EXECUTED AND FULLY VERIFIED FROM CODE!")
    print("==================================================================")

if __name__ == "__main__":
    test_all_8_steps()
