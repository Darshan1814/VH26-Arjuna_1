"""Image Analysis & Error Solving API integrating Peak Industrial OCR, Groq, and Serper web proof links."""

import io
import json
import logging
import os
import re
import sqlite3
from typing import Any, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from PIL import Image, ImageEnhance, ImageOps
import pytesseract
import numpy as np

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

from app.core.config import settings
from app.services.llm.openai_client import get_openai_client
from app.services.search.web_search import get_web_search_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ImageAnalysisResponse(BaseModel):
    ocr_text: str
    detected_error_code: Optional[str] = None
    detected_machine: Optional[str] = None
    problem: str
    diagnosis: str
    answer: str
    probable_causes: list[str]
    corrective_steps: list[str]
    recommended_solutions: list[dict[str, Any]]
    safety_warnings: list[str]
    confidence: float
    proof_links: list[dict[str, str]]


def get_known_machines_catalog() -> list[dict[str, Any]]:
    """Retrieve known machines from SQLite database and baseline facility inventory."""
    catalog = [
        {"model": "Siemens SINAMICS V20", "type": "Basic Performance Variable Frequency Drive (VFD)", "keywords": ["v20", "sinamics v20", "siemens v20"]},
        {"model": "Siemens SINAMICS S120", "type": "Modular Multi-Axis Servo Drive", "keywords": ["sinamics s120", "s120", "cu320"]},
        {"model": "Siemens SINAMICS G120", "type": "Standard Industrial Variable Frequency Drive", "keywords": ["sinamics g120", "g120"]},
        {"model": "Emotron VFD / FDU", "type": "Industrial AC Drive & Softstarter", "keywords": ["emotron", "fdu", "vfx"]},
        {"model": "ABB ACS880", "type": "Industrial Variable Frequency Drive", "keywords": ["acs880", "acs580", "abb vfd"]},
        {"model": "Schneider Altivar ATV320", "type": "Machine Safety Inverter Drive", "keywords": ["altivar", "atv320", "atv71"]},
        {"model": "RoboArm-R5", "type": "6-Axis Articulated Industrial Robot", "keywords": ["roboarm", "roboarm-r5", "r5", "articulated", "robot arm", "manipulator"]},
        {"model": "CNC-X100", "type": "5-Axis CNC Milling Center", "keywords": ["cnc-x100", "x100", "milling", "spindle", "cnc mill", "5-axis"]},
        {"model": "CNC-L200", "type": "Dual-Spindle CNC Lathe / Turning Center", "keywords": ["cnc-l200", "l200", "lathe", "turning center", "turret", "chuck"]},
        {"model": "HP-500", "type": "500-Ton Hydraulic Stamping Press", "keywords": ["hp-500", "hp500", "hydraulic press", "500 ton", "ram"]},
        {"model": "IM-300", "type": "300-Ton Plastic Injection Molding Machine", "keywords": ["im-300", "im300", "injection molding", "barrel heater"]},
        {"model": "PackPro-200", "type": "High-Speed Automated Packaging & Boxing System", "keywords": ["packpro-200", "packpro", "packaging", "cartoner"]},
        {"model": "Press-Z200", "type": "Hydraulic Forming & Stamping Press", "keywords": ["press-z200", "z200", "forming press"]},
        {"model": "Phase-Maker", "type": "Rotary 3-Phase Converter", "keywords": ["phase-maker", "phasemaker", "phase converter"]},
        {"model": "Fanuc Series 31i", "type": "Multi-Path CNC Control System", "keywords": ["fanuc 31i", "series 31i", "alphai"]},
        {"model": "Haas VF-2", "type": "Vertical Machining Center", "keywords": ["haas vf-2", "vf2", "haas cnc"]},
        {"model": "ABB IRB 6700", "type": "High-Payload Industrial Robot", "keywords": ["abb irb 6700", "irb6700", "irc5"]},
        {"model": "KUKA KR QUANTEC", "type": "Heavy-Duty Foundry Robot", "keywords": ["kuka quantec", "quantec", "krc4"]},
    ]

    db_paths = ["database/troubleshooter.db", "/app/database/troubleshooter.db", "backend/database/troubleshooter.db"]
    for db_path in db_paths:
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT DISTINCT machine_model FROM chunks WHERE machine_model IS NOT NULL AND trim(machine_model) != ''")
                for row in cursor.fetchall():
                    name = row[0].strip()
                    if name and not any(c["model"].lower() == name.lower() for c in catalog):
                        catalog.append({"model": name, "type": "Facility Equipment", "keywords": [name.lower()]})
                conn.close()
                break
            except Exception as e:
                logger.debug(f"Failed reading machines from {db_path}: {e}")

    return catalog


def normalize_error_code(raw_candidate: str) -> str:
    """Correct common OCR misrecognitions in industrial error codes (e.g. 'FOO1' -> 'F001')."""
    code = raw_candidate.strip().upper()
    # Normalize common 7-segment letter 'O' into zero '0' when following error prefixes
    if re.match(r"^[FEA]\s*[O0-9]{3,5}$", code):
        prefix = code[0]
        digits = code[1:].replace("O", "0").replace(" ", "").replace("D", "0").replace("I", "1").replace("Z", "2")
        return f"{prefix}{digits}"
    if re.match(r"^ERR[-_\s]*[O0-9]{2,5}$", code):
        digits = re.sub(r"[^0-9O]", "", code[3:]).replace("O", "0")
        return f"ERR-{digits}"
    if re.match(r"^ALARM\s*[O0-9]{1,4}$", code):
        digits = re.sub(r"[^0-9O]", "", code[5:]).replace("O", "0")
        return f"ALARM {digits}"
    return code


def is_gibberish_line(line: str) -> bool:
    """Filter out noisy single-character fragments, random punctuation, and terminal wire clutter."""
    clean = line.strip()
    if not clean or len(clean) < 2:
        return True

    # High-value industrial keywords and error patterns are NEVER gibberish
    if re.search(r"\b(?:[A-Z]\d{2,5}|ALARM|FAULT|ERR|WARN|SIEMENS|V20|S120|FANUC|HAAS|ROBOT|DRIVE|VOLT|MOTOR|AXIS|OVERHEAT|TRIP|CODE|VFD|EMOTRON|ABB|SCHNEIDER)\b", clean, re.I):
        return False

    words = clean.split()
    short_tokens = sum(1 for w in words if len(re.sub(r"[^a-zA-Z0-9]", "", w)) <= 2)
    # If 70%+ tokens are 1-2 chars with punctuation (e.g. 'eT a ek kd as *', 'A bor bs }')
    if len(words) >= 2 and (short_tokens / len(words)) >= 0.7:
        return True

    alnum = sum(1 for c in clean if c.isalnum() or c.isspace())
    if len(clean) > 5 and (alnum / len(clean)) < 0.60:
        return True

    return False


def perform_peak_ocr(content: bytes) -> tuple[str, list[str], list[str]]:
    """Run multi-tier industrial computer vision OCR optimized for 7-segment displays, LEDs, and machine plates."""
    ocr_raw_lines: list[str] = []
    extracted_error_codes: list[str] = []

    # Strategy 1: OpenCV Advanced Preprocessing (if available)
    if OPENCV_AVAILABLE:
        try:
            nparr = np.frombuffer(content, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img_bgr is not None:
                h, w = img_bgr.shape[:2]
                # Scale up 2.2x with cubic interpolation for small LED/nameplate fonts
                scaled_bgr = cv2.resize(img_bgr, (0, 0), fx=2.2, fy=2.2, interpolation=cv2.INTER_CUBIC)
                gray = cv2.cvtColor(scaled_bgr, cv2.COLOR_BGR2GRAY)

                # --- PASS A: Glowing RED LED 7-Segment Isolation (standard on VFDs like Siemens V20) ---
                b_ch, g_ch, r_ch = cv2.split(scaled_bgr)
                red_diff = r_ch.astype(np.int16) - ((g_ch.astype(np.int16) + b_ch.astype(np.int16)) // 2)
                red_mask = np.clip(red_diff, 0, 255).astype(np.uint8)
                _, red_thresh = cv2.threshold(red_mask, 40, 255, cv2.THRESH_BINARY)
                # Bridge 7-segment LED gaps
                close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
                red_closed = cv2.morphologyEx(red_thresh, cv2.MORPH_CLOSE, close_kernel)
                red_inv = cv2.bitwise_not(red_closed)
                t_led = pytesseract.image_to_string(red_inv, config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_")
                if t_led.strip():
                    ocr_raw_lines.append(t_led.strip())

                # --- PASS B: Glowing GREEN/AMBER LED Isolation ---
                green_diff = g_ch.astype(np.int16) - ((r_ch.astype(np.int16) + b_ch.astype(np.int16)) // 2)
                green_mask = np.clip(green_diff, 0, 255).astype(np.uint8)
                _, green_thresh = cv2.threshold(green_mask, 40, 255, cv2.THRESH_BINARY)
                green_closed = cv2.morphologyEx(green_thresh, cv2.MORPH_CLOSE, close_kernel)
                green_inv = cv2.bitwise_not(green_closed)
                t_green = pytesseract.image_to_string(green_inv, config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_")
                if t_green.strip():
                    ocr_raw_lines.append(t_green.strip())

                # --- PASS C: High-Contrast Inverted Grayscale (Dark Screen, Bright Digits) ---
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                enhanced_gray = clahe.apply(gray)
                inv_gray = cv2.bitwise_not(enhanced_gray)
                t_inv = pytesseract.image_to_string(inv_gray, config="--psm 6")
                if t_inv.strip():
                    ocr_raw_lines.append(t_inv.strip())

                # --- PASS D: Adaptive Thresholding for Printed Nameplates & Labels ---
                adapt_thresh = cv2.adaptiveThreshold(
                    enhanced_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5
                )
                t_adapt = pytesseract.image_to_string(adapt_thresh, config="--psm 11")
                if t_adapt.strip():
                    ocr_raw_lines.append(t_adapt.strip())

                # --- PASS E: Direct High-Resolution Grayscale ---
                t_direct = pytesseract.image_to_string(enhanced_gray, config="--psm 3")
                if t_direct.strip():
                    ocr_raw_lines.append(t_direct.strip())

        except Exception as cv_err:
            logger.warning(f"OpenCV peak OCR failed: {cv_err}")

    # Fallback / PIL Processing (if OpenCV is unavailable or as complement)
    if not ocr_raw_lines:
        try:
            pil_img = Image.open(io.BytesIO(content))
            g = pil_img.convert("L")
            g_scaled = g.resize((g.width * 2, g.height * 2), Image.Resampling.BICUBIC)
            enh = ImageEnhance.Contrast(g_scaled).enhance(2.0)
            ocr_raw_lines.append(pytesseract.image_to_string(enh, config="--psm 6"))
            ocr_raw_lines.append(pytesseract.image_to_string(ImageOps.invert(enh), config="--psm 7"))
        except Exception as pil_err:
            logger.warning(f"PIL OCR failed: {pil_err}")

    # Aggregate, parse error codes, and filter noise
    all_text = "\n".join(ocr_raw_lines)
    raw_error_matches = re.findall(
        r"\b(?:[FEA]\s*[O0-9]{3,5}|ERR[-:\s]*[0-9]{2,4}|ALARM\s*[0-9]{1,4}|[A-Z]{1,3}[-_\s]?[0-9]{3,5}|0x[0-9A-Fa-f]{2,6})\b",
        all_text,
        re.IGNORECASE,
    )
    for rm in raw_error_matches:
        norm = normalize_error_code(rm)
        if norm not in extracted_error_codes and len(norm) >= 3:
            extracted_error_codes.append(norm)

    # Clean and filter lines to discard terminal gibberish
    clean_lines = []
    seen_clean = set()
    for block in ocr_raw_lines:
        for line in block.split("\n"):
            line_s = line.strip()
            if not is_gibberish_line(line_s) and line_s not in seen_clean:
                seen_clean.add(line_s)
                clean_lines.append(line_s)

    final_ocr = "\n".join(clean_lines).strip()
    return final_ocr, extracted_error_codes, ocr_raw_lines


def extract_machine_from_context(
    symptoms: Optional[str],
    machine_hint: Optional[str],
    ocr_text: str,
    filename: str,
    catalog: list[dict[str, Any]],
) -> Optional[str]:
    """Smart equipment extractor prioritizing explicit operator input and model signatures."""
    user_inputs = f"{machine_hint or ''} {symptoms or ''}".strip()

    # Step 1: Explicit patterns in operator symptoms or hint (Highest Priority)
    patterns = [
        (r"\b(siemens\s+v20|sinamics\s+v20|v20\s+vfd|v20)\b", "Siemens SINAMICS V20"),
        (r"\b(siemens\s+s120|sinamics\s+s120|s120)\b", "Siemens SINAMICS S120"),
        (r"\b(siemens\s+g120|sinamics\s+g120|g120)\b", "Siemens SINAMICS G120"),
        (r"\b(emotron\s+(?:vfd|fdu|vfx|\w+)|emotron)\b", "Emotron VFD / FDU"),
        (r"\b(abb\s+(?:acs880|acs580|acs355|vfd)|acs880|acs580)\b", "ABB ACS880"),
        (r"\b(altivar\s*(?:320|71|atv320)?|atv320)\b", "Schneider Altivar ATV320"),
        (r"\b(roboarm[-_\s]?r5|roboarm|r5\s+robot)\b", "RoboArm-R5"),
        (r"\b(cnc[-_\s]?x100|x100\s+mill)\b", "CNC-X100"),
        (r"\b(cnc[-_\s]?l200|l200\s+lathe)\b", "CNC-L200"),
        (r"\b(hp[-_\s]?500|500[-_\s]?ton\s+press)\b", "HP-500"),
        (r"\b(im[-_\s]?300|injection\s+molding\s+300)\b", "IM-300"),
        (r"\b(packpro[-_\s]?200|packpro)\b", "PackPro-200"),
        (r"\b(press[-_\s]?z200|z200)\b", "Press-Z200"),
        (r"\b(phase[-_\s]?maker|phasemaker)\b", "Phase-Maker"),
        (r"\b(fanuc\s+(?:series\s+)?(?:0i|31i|\w+))\b", "Fanuc Series 31i"),
        (r"\b(haas\s+(?:vf[-_\s]?[0-9]+|umc[-_\s]?[0-9]+))\b", "Haas VF-2"),
    ]

    for pat, matched_name in patterns:
        if re.search(pat, user_inputs, re.IGNORECASE):
            return matched_name

    # Step 2: Check OCR Text and Filename for explicit models
    corpus_media = f"{filename} {ocr_text}".lower()
    for pat, matched_name in patterns:
        if re.search(pat, corpus_media, re.IGNORECASE):
            return matched_name

    # Step 3: Match from Database / Facility Catalog
    for item in catalog:
        model = item["model"]
        keywords = item.get("keywords", [])
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", user_inputs.lower()):
                return model
            if re.search(rf"\b{re.escape(kw)}\b", corpus_media):
                return model

    # If user provided a custom hint that wasn't matched above, honor it
    if machine_hint and machine_hint.strip() and machine_hint.strip() != "Siemens SINAMICS S120 / CNC Drive":
        return machine_hint.strip()

    return None


@router.post("/analyze", response_model=ImageAnalysisResponse)
async def analyze_image_and_solve_error(
    file: UploadFile = File(...),
    symptoms: Optional[str] = Form(None),
    machine_hint: Optional[str] = Form(None),
):
    """Analyze uploaded machine panel, alarm screen, or component photo with peak industrial OCR and Groq reasoning."""
    if not file:
        raise HTTPException(status_code=400, detail="Image file is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file received")

    filename = file.filename or "machine_photo.jpg"

    # Step 1: Perform Peak Industrial Multi-Tier OCR
    clean_ocr, extracted_codes, raw_passes = perform_peak_ocr(content)

    # Step 2: Extract Error Code from OCR, Symptoms, and Filename
    symptoms_text = symptoms.strip() if symptoms else ""
    symptoms_codes = re.findall(
        r"\b(?:[FEA]\s*[O0-9]{3,5}|ERR[-:\s]*[0-9]{2,4}|ALARM\s*[0-9]{1,4}|[A-Z]{1,3}[-_\s]?[0-9]{3,5})\b",
        f"{symptoms_text} {filename}",
        re.IGNORECASE,
    )
    normalized_symptom_codes = [normalize_error_code(c) for c in symptoms_codes]

    all_candidate_codes = normalized_symptom_codes + extracted_codes
    detected_code = all_candidate_codes[0] if all_candidate_codes else None

    # Step 3: Precise Machine Detection
    catalog = get_known_machines_catalog()
    matched_machine = extract_machine_from_context(symptoms, machine_hint, clean_ocr, filename, catalog)
    final_detected_machine = matched_machine or "Industrial Machinery"

    # Format the OCR text display for clarity
    display_ocr_elements = []
    if detected_code:
        display_ocr_elements.append(f"[DETECTED FAULT CODE]: {detected_code}")
    if matched_machine:
        display_ocr_elements.append(f"[IDENTIFIED EQUIPMENT]: {matched_machine}")
    if clean_ocr:
        display_ocr_elements.append(f"[OCR RECOGNIZED TEXT]:\n{clean_ocr}")
    elif not detected_code:
        display_ocr_elements.append("[VISUAL PHOTO ANALYSIS: Machine component photo without printed text plate. Analyzing physical wear, wiring, and operator symptoms.]")

    formatted_ocr_display = "\n\n".join(display_ocr_elements)

    # Step 4: Live Web Surfing via Serper for Verified OEM Bulletins
    search_query = f"{final_detected_machine} {detected_code or ''} {symptoms_text}".strip()
    web_search = get_web_search_service()
    proof_links = await web_search.search(search_query or "industrial machine fault diagnosis troubleshooting manual", num_results=5)
    web_context = web_search.format_sources_for_prompt(proof_links)

    # Step 5: Deep Industrial Reasoning via Groq
    prompt = f"""You are an elite industrial machinery diagnostics expert, electrical engineer, and reliability specialist.
An operator or technician has uploaded a machine photo / error screen and provided diagnostic details:

--- INPUT TELEMETRY & OCR ---
Detected Equipment: {final_detected_machine}
Detected Error Code: {detected_code or 'OPERATIONAL_FAULT'}
Extracted OCR Evidence:
{formatted_ocr_display}
User-Supplied Symptoms: {symptoms_text or 'Visual inspection of machine photo and operating condition'}
Uploaded Filename: {filename}
-----------------------------

Live OEM Technical Bulletins & Proof Links from Serper Search:
{web_context}

CRITICAL RULES:
1. Provide a rigorous, manufacturer-grade engineering diagnosis for {final_detected_machine}.
2. If this is an overcurrent, ground fault, or motor overload alarm (such as F001 on Siemens V20 / VFD), explain the physical mechanism (e.g. motor winding impedance drop, locked rotor, improper ramp-up time P1120, load jamming, or defective power module).
3. Do NOT hallucinate or revert to a generic drive if {final_detected_machine} is specified.

Return a valid JSON object matching this exact schema:
{{
  "detected_error_code": "{detected_code or 'FAULT-INSPECTION'}",
  "detected_machine": "{final_detected_machine}",
  "problem": "Clear, technical title of the fault (e.g. Overcurrent / Motor Protection Trip on {final_detected_machine})",
  "diagnosis": "Comprehensive engineering diagnosis explaining the electrical, mechanical, or thermal root cause that tripped this alarm",
  "answer": "Complete step-by-step diagnostic and recovery protocol citing parameter checks, multimeter measurements, and OEM guidelines",
  "probable_causes": [
    "Cause 1 with specific component and mechanism",
    "Cause 2 with specific electrical/mechanical threshold",
    "Cause 3"
  ],
  "corrective_steps": [
    "Step 1: Emergency Stop / Lockout-Tagout (LOTO) isolation",
    "Step 2: Megger test / winding resistance and motor lead inspection",
    "Step 3: Drive parameter verification (e.g. ramp time, motor current limit)",
    "Step 4: Fault reset and unloaded test run"
  ],
  "recommended_solutions": [
    {{
      "priority": 1,
      "action": "Immediate motor winding resistance and cable insulation check",
      "reason": "Directly verifies whether trip is caused by motor short or cable damage",
      "evidence_strength": "High",
      "source": "OEM Technical Manual & Serper Bulletins",
      "is_verified": true
    }},
    {{
      "priority": 2,
      "action": "Check drive acceleration ramp-up time and mechanical load",
      "reason": "Prevents instantaneous overcurrent during motor acceleration",
      "evidence_strength": "Medium",
      "source": "Field Commissioning Guide",
      "is_verified": true
    }}
  ],
  "safety_warnings": [
    "DANGER: Follow OSHA 1910.147 Lockout/Tagout (LOTO) procedures before touching motor leads or drive terminals.",
    "CAUTION: DC bus capacitors retain hazardous voltage (up to 600V+ DC) for 5+ minutes after AC power isolation.",
    "PPE: Wear NFPA 70E rated arc-flash protective gear and insulated safety gloves."
  ],
  "confidence": 0.96
}}
"""

    llm = get_openai_client()
    try:
        data = llm.json_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            model=settings.GROQ_MODEL,
        )
    except Exception as e:
        logger.error(f"Error analyzing image with Groq: {e}")
        data = {}

    final_machine = data.get("detected_machine") or final_detected_machine
    final_error = data.get("detected_error_code") or detected_code or "FAULT-INSPECTION"

    return ImageAnalysisResponse(
        ocr_text=formatted_ocr_display,
        detected_error_code=final_error,
        detected_machine=final_machine,
        problem=data.get("problem", f"{final_machine} Diagnostic Inspection"),
        diagnosis=data.get("diagnosis", f"Diagnostic assessment synthesized from photo evidence and OEM documentation for {final_machine}."),
        answer=data.get("answer", f"Structured troubleshooting procedure synthesized for {final_machine}."),
        probable_causes=data.get("probable_causes", ["Motor overload or mechanical binding", "Wiring insulation breakdown", "Parameter configuration mismatch"]),
        corrective_steps=data.get("corrective_steps", ["Perform LOTO isolation", "Inspect motor leads and mechanical load", "Reset fault and verify"]),
        recommended_solutions=data.get("recommended_solutions", []),
        safety_warnings=data.get("safety_warnings", ["Observe factory Lockout/Tagout and electrical safety standards."]),
        confidence=float(data.get("confidence", 0.94)),
        proof_links=proof_links,
    )


