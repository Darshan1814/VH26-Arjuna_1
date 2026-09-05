import json
import sys
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_universal_pipeline():
    session_id = "TEST-CNC-99"

    cnc_content = """EQUIPMENT SPECIFICATION AND SERVICE MANUAL: CNC MILLING CENTER V400
MANUFACTURER: ARJUNA PRECISION DYNAMICS
MODEL: V400-CNC-3AXIS

1. SYSTEM OVERVIEW & RATINGS
The CNC Milling Center V400 is an automated 3-axis industrial vertical machining center.
Operating Voltage: 400V 3-Phase, 50/60 Hz.
Spindle Power: 15 kW / 20 HP, Maximum RPM: 12,000.
Coolant Tank Capacity: 250 Liters with high-pressure flood coolant pump (4.5 bar).

2. COMMON FAULT CODES & DIAGNOSTICS
ERROR CODE E-104: SPINDLE OVERHEAT & COOLANT PRESSURE FAILURE
Symptom: Spindle temperature exceeds 75 degrees C during high-speed roughing, accompanied by automatic feed-hold.
Causes:
- Primary cause: Coolant line filtration blockage causing inadequate fluid delivery to spindle jacket.
- Secondary cause: Coolant pump thermal overload trip or low reservoir fluid level below minimum sensor.
- Tertiary cause: Spindle chiller heat exchanger clogged with metal chips or debris.

Corrective Action / Solution:
1. Immediately inspect coolant reservoir level and top up with 8% semi-synthetic soluble oil emulsion.
2. Clean or replace the 50-micron inline coolant filter cartridge located at the rear service manifold.
3. Inspect and clear spindle chiller intake fins of metal swarf to restore optimal heat rejection.
4. Reset thermal overload switch on pump breaker CB-4 after verifying free impeller rotation.

3. MANDATORY SAFETY WARNINGS
- Always verify spindle zero-speed interlock before opening protective safety enclosure doors.
- Disconnect main isolator switch and discharge pneumatic accumulator before servicing coolant manifold.
- Earthing ground bond must measure less than 10 Ohms resistance.
"""

    print(f"1. Uploading CNC Milling Center manual into session {session_id}...")
    files = [
        ("files", ("CNC_Milling_Center_V400.txt", cnc_content.encode("utf-8"), "text/plain"))
    ]
    resp = requests.post(f"{BASE_URL}/api/process-flow/upload", files=files, data={"session_id": session_id})
    assert resp.status_code == 200, f"Upload failed: {resp.text}"
    print("   Upload success:", resp.json())

    # Step 1: Document Intake
    print("2. Running Step 1 (Document Intake)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/1")
    assert resp.status_code == 200
    telemetry1 = resp.json()["telemetry"]
    print("   Step 1 equipment:", telemetry1["document_profile"]["equipment_name"])
    assert "phasemaker" not in telemetry1["document_profile"]["equipment_name"].lower(), "Step 1 leaked PhaseMaker!"

    # Step 2: OCR & Extraction
    print("3. Running Step 2 (Extraction & Sections)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/2")
    assert resp.status_code == 200
    telemetry2 = resp.json()["telemetry"]
    print(f"   Step 2 pages: {telemetry2['pages_processed']}, sections: {len(telemetry2['detected_items'])}")

    # Step 3: Equipment Extraction
    print("4. Running Step 3 (Equipment Identification)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/3")
    assert resp.status_code == 200
    telemetry3 = resp.json()["telemetry"]
    detected_machine = telemetry3["detected_machine"]
    print("   Step 3 detected machine:", detected_machine)
    print("   Step 3 suggested queries:", [q.encode('ascii', 'ignore').decode() for q in telemetry3.get("suggested_queries", [])])
    assert "phasemaker" not in detected_machine.lower(), "Step 3 leaked PhaseMaker!"
    assert "cnc" in detected_machine.lower() or "milling" in detected_machine.lower() or "v400" in detected_machine.lower() or "arjuna" in detected_machine.lower(), f"Unexpected machine: {detected_machine}"

    # Step 4: Chunking
    print("5. Running Step 4 (Chunking & Embeddings)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/4")
    assert resp.status_code == 200
    telemetry4 = resp.json()["telemetry"]
    print(f"   Step 4 chunks created: {telemetry4['total_chunks_created']}")
    assert telemetry4["total_chunks_created"] > 0
    sample_chunk = telemetry4["sample_chunks"][0]
    print(f"   Sample chunk machine: {sample_chunk['machine']}")
    assert "phasemaker" not in sample_chunk["machine"].lower(), "Step 4 chunk leaked PhaseMaker!"

    # Step 5: Database Storage
    print("6. Running Step 5 (Database Storage)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/5")
    assert resp.status_code == 200

    # Step 6: Search Index
    print("7. Running Step 6 (Search Index)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/6")
    assert resp.status_code == 200
    telemetry6 = resp.json()["telemetry"]
    print("   Step 6 tokens:", telemetry6["technical_tokens"])

    # Step 7: Confidence Calibration
    print("8. Running Step 7 (Evidence Readiness)...")
    resp = requests.post(f"{BASE_URL}/api/process-flow/{session_id}/step/7")
    assert resp.status_code == 200
    telemetry7 = resp.json()["telemetry"]
    print(f"   Step 7 confidence: {telemetry7['confidence_score']} ({telemetry7['confidence_level']})")

    # Step 8: User Query Verification & Grounded Diagnosis Execution
    user_query = "Why is the spindle overheating with error code E-104 on CNC Milling Center V400?"
    print(f"9. Running Step 8 with custom user query: '{user_query}'...")
    resp = requests.post(
        f"{BASE_URL}/api/process-flow/{session_id}/step/8",
        json={"user_input": {"query": user_query}},
    )
    assert resp.status_code == 200
    telemetry8 = resp.json()["telemetry"]
    final = telemetry8["final_result"]

    print("\n--- STEP 8 DIAGNOSTIC RESULTS ---")
    print("Query:", final["problem"])
    print("Diagnosis:", final["diagnosis"])
    print("Probable Causes:", final["probable_causes"])
    print("Recommended Solutions:")
    for s in final["recommended_solutions"]:
        print(f"  - [{s.get('priority')}] {s.get('action')}")
        print(f"    Source: {s.get('source')}")

    # Assertions
    full_output = json.dumps(telemetry8).lower()
    assert "phasemaker" not in full_output, "CRITICAL ERROR: PhaseMaker found in Step 8 output!"
    assert "rotary converter" not in full_output, "CRITICAL ERROR: Rotary Converter found in Step 8 output!"
    assert "e-104" in full_output or "spindle" in full_output or "coolant" in full_output, "Diagnostic output did not ground in CNC document!"

    print("\n✅ ALL 8 STEPS PASSED UNIVERSALLY WITH ZERO PHASEMAKER REFERENCES!")

if __name__ == "__main__":
    test_universal_pipeline()
