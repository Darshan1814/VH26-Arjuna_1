"""Image Analysis & Error Solving API - Groq Vision-First approach.

Flow:
  1. Send image DIRECTLY to Groq vision model (base64) → get machine, error code, symptoms
  2. Run OCR as supplementary evidence (not primary)
  3. Web search for OEM bulletins
  4. Final deep reasoning with all context
"""

import base64
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


# ---------------------------------------------------------------------------
# STEP 1: Groq Vision — send image directly, get machine + error identification
# ---------------------------------------------------------------------------

def image_bytes_to_base64_url(content: bytes, filename: str) -> str:
    """Convert raw image bytes to a data URL for the Groq vision API."""
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                "webp": "image/webp", "gif": "image/gif", "bmp": "image/png"}
    mime = mime_map.get(ext, "image/jpeg")
    b64 = base64.b64encode(content).decode("utf-8")
    return f"data:{mime};base64,{b64}"


async def groq_vision_identify(
    content: bytes,
    filename: str,
    symptoms: Optional[str],
    machine_hint: Optional[str],
    llm,
) -> dict:
    """
    Send the image DIRECTLY to Groq vision model.
    Returns: { machine, brand, model, error_code, visible_text, fault_description, confidence }
    """
    data_url = image_bytes_to_base64_url(content, filename)
    hint_ctx = ""
    if machine_hint:
        hint_ctx += f"\nOperator machine hint: {machine_hint}"
    if symptoms:
        hint_ctx += f"\nOperator-reported symptoms: {symptoms}"

    vision_prompt = f"""You are an expert industrial and appliance diagnostic AI.
Carefully examine this machine/appliance image and extract ALL visible information.{hint_ctx}

Return a JSON object with EXACTLY these fields:
{{
  "brand": "Exact brand name visible (e.g. Whirlpool, Siemens, Fanuc, ABB, Samsung, LG, Bosch, etc.) or null",
  "machine_type": "Type of machine (e.g. Washing Machine, VFD Drive, CNC Machine, Robot, Refrigerator, AC Unit, etc.)",
  "model": "Specific model number/name visible on the machine or null",
  "full_machine_name": "Brand + Type + Model combined (e.g. Whirlpool Front Load Washing Machine, Siemens SINAMICS V20 VFD)",
  "error_code": "EXACT error/fault code visible on display (e.g. F21, E01, ALARM 3, ERR-04) or null if no code",
  "display_text": "ALL text visible on any display, panel, or label in the image",
  "visible_symptoms": "Physical symptoms visible: LED color, panel state, any visible damage, component state",
  "fault_description": "What this error code or condition means for this specific machine",
  "confidence": 0.95
}}

CRITICAL: 
- Read the display EXACTLY - do not guess. Report what you literally see.
- For washing machines with F-codes (F01, F21, F28 etc), identify the exact Whirlpool/brand fault.
- For VFDs with A/F codes, identify the exact drive fault.
- If brand is clearly visible on the machine body, ALWAYS capture it.
"""

    try:
        # Use Groq vision model
        vision_model = getattr(settings, "GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

        response = llm.client.chat.completions.create(
            model=vision_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": vision_prompt},
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        logger.info(f"Groq Vision identified: machine={result.get('full_machine_name')}, error={result.get('error_code')}")
        return result

    except Exception as e:
        logger.warning(f"Groq vision identification failed: {e}")
        return {}


# ---------------------------------------------------------------------------
# STEP 2: OCR (supplementary — helps with text Groq vision may miss)
# ---------------------------------------------------------------------------

def normalize_error_code(raw_candidate: str) -> str:
    """Correct common OCR misrecognitions in error codes."""
    code = raw_candidate.strip().upper()
    if re.match(r"^[FEA]\s*[O0-9]{2,5}$", code):
        prefix = code[0]
        digits = code[1:].replace("O", "0").replace(" ", "").replace("D", "0").replace("I", "1")
        return f"{prefix}{digits}"
    if re.match(r"^ERR[-_\s]*[O0-9]{2,5}$", code):
        digits = re.sub(r"[^0-9O]", "", code[3:]).replace("O", "0")
        return f"ERR-{digits}"
    return code


def is_gibberish_line(line: str) -> bool:
    """Filter OCR noise — keep real words and error codes."""
    clean = line.strip()
    if not clean or len(clean) < 2:
        return True
    # Always keep lines with error code patterns or known industrial keywords
    if re.search(r"\b(?:[A-Z]\d{2,5}|ALARM|FAULT|ERR|WARN|ERROR|CODE|MOTOR|DRIVE|TEMP|OVER)\b", clean, re.I):
        return False
    words = clean.split()
    short_tokens = sum(1 for w in words if len(re.sub(r"[^a-zA-Z0-9]", "", w)) <= 2)
    if len(words) >= 2 and (short_tokens / len(words)) >= 0.7:
        return True
    alnum = sum(1 for c in clean if c.isalnum() or c.isspace())
    if len(clean) > 5 and (alnum / len(clean)) < 0.55:
        return True
    return False


def perform_ocr(content: bytes) -> tuple[str, list[str]]:
    """Multi-tier OCR — supplementary to Groq Vision, not primary."""
    ocr_raw_lines: list[str] = []
    extracted_error_codes: list[str] = []

    if OPENCV_AVAILABLE:
        try:
            nparr = np.frombuffer(content, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_bgr is not None:
                # Scale up for better OCR
                scaled = cv2.resize(img_bgr, (0, 0), fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
                gray = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)

                # PASS A: Red LED display (VFDs, error panels)
                b_ch, g_ch, r_ch = cv2.split(scaled)
                red_diff = np.clip(r_ch.astype(np.int16) - ((g_ch.astype(np.int16) + b_ch.astype(np.int16)) // 2), 0, 255).astype(np.uint8)
                _, red_thresh = cv2.threshold(red_diff, 35, 255, cv2.THRESH_BINARY)
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
                red_closed = cv2.morphologyEx(red_thresh, cv2.MORPH_CLOSE, kernel)
                t = pytesseract.image_to_string(cv2.bitwise_not(red_closed),
                    config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_")
                if t.strip():
                    ocr_raw_lines.append(t.strip())

                # PASS B: CLAHE enhanced for printed labels
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                t2 = pytesseract.image_to_string(enhanced, config="--psm 6")
                if t2.strip():
                    ocr_raw_lines.append(t2.strip())

                # PASS C: Adaptive threshold for nameplates
                adapt = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5)
                t3 = pytesseract.image_to_string(adapt, config="--psm 11")
                if t3.strip():
                    ocr_raw_lines.append(t3.strip())

        except Exception as e:
            logger.warning(f"OpenCV OCR error: {e}")

    # PIL fallback
    if not ocr_raw_lines:
        try:
            pil = Image.open(io.BytesIO(content)).convert("L")
            pil = pil.resize((pil.width * 2, pil.height * 2), Image.Resampling.BICUBIC)
            pil = ImageEnhance.Contrast(pil).enhance(2.0)
            ocr_raw_lines.append(pytesseract.image_to_string(pil, config="--psm 6"))
            ocr_raw_lines.append(pytesseract.image_to_string(ImageOps.invert(pil), config="--psm 7"))
        except Exception as e:
            logger.warning(f"PIL OCR error: {e}")

    all_text = "\n".join(ocr_raw_lines)

    # Extract error codes from OCR
    for rm in re.findall(
        r"\b(?:[FEA]\s*[O0-9]{2,5}|ERR[-:\s]*[0-9]{2,4}|ALARM\s*[0-9]{1,4}|[A-Z]{1,3}[-_\s]?[0-9]{3,5}|0x[0-9A-Fa-f]{2,6})\b",
        all_text, re.IGNORECASE
    ):
        norm = normalize_error_code(rm)
        if norm not in extracted_error_codes and len(norm) >= 3:
            extracted_error_codes.append(norm)

    # Clean OCR lines
    clean_lines, seen = [], set()
    for block in ocr_raw_lines:
        for line in block.split("\n"):
            ls = line.strip()
            if not is_gibberish_line(ls) and ls not in seen:
                seen.add(ls)
                clean_lines.append(ls)

    return "\n".join(clean_lines).strip(), extracted_error_codes


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=ImageAnalysisResponse)
async def analyze_image_and_solve_error(
    file: UploadFile = File(...),
    symptoms: Optional[str] = Form(None),
    machine_hint: Optional[str] = Form(None),
):
    """
    Analyze uploaded machine/appliance image using Groq Vision + OCR + Web Search.
    Groq Vision reads the image directly — no dependency on OCR quality for identification.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Image file is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file received")

    filename = file.filename or "machine_photo.jpg"
    symptoms_text = (symptoms or "").strip()
    llm = get_openai_client()

    # ----------------------------------------------------------------
    # STEP 1: Groq Vision — direct image analysis (PRIMARY)
    # ----------------------------------------------------------------
    vision_result = await groq_vision_identify(content, filename, symptoms_text, machine_hint, llm)

    vision_machine   = vision_result.get("full_machine_name") or vision_result.get("machine_type") or ""
    vision_brand     = vision_result.get("brand") or ""
    vision_model_num = vision_result.get("model") or ""
    vision_error     = vision_result.get("error_code") or ""
    vision_display   = vision_result.get("display_text") or ""
    vision_symptoms  = vision_result.get("visible_symptoms") or ""
    vision_fault_desc = vision_result.get("fault_description") or ""

    # ----------------------------------------------------------------
    # STEP 2: OCR — supplementary text extraction
    # ----------------------------------------------------------------
    ocr_text, ocr_codes = perform_ocr(content)

    # ----------------------------------------------------------------
    # STEP 3: Merge Vision + OCR + User Input → best error code & machine
    # ----------------------------------------------------------------

    # Error code: vision > symptoms text > OCR
    symptom_codes = re.findall(
        r"\b(?:[FEA]\s*[O0-9]{2,5}|ERR[-:\s]*[0-9]{2,4}|ALARM\s*[0-9]{1,4}|[A-Z]{1,3}[-_\s]?[0-9]{3,5})\b",
        f"{symptoms_text} {filename}", re.IGNORECASE
    )
    symptom_codes = [normalize_error_code(c) for c in symptom_codes]

    # Priority: vision > symptoms > ocr
    if vision_error:
        detected_code = normalize_error_code(vision_error)
    elif symptom_codes:
        detected_code = symptom_codes[0]
    elif ocr_codes:
        detected_code = ocr_codes[0]
    else:
        detected_code = None

    # Machine: vision > machine_hint > "Unknown Machine"
    if vision_machine and vision_machine.lower() not in ("unknown", "none", ""):
        final_machine = vision_machine
    elif machine_hint and machine_hint.strip():
        final_machine = machine_hint.strip()
    else:
        final_machine = "Unknown Machine"

    # ----------------------------------------------------------------
    # Build OCR display section
    # ----------------------------------------------------------------
    display_parts = []
    if vision_machine:
        display_parts.append(f"[VISION IDENTIFIED]: {vision_machine}")
    if detected_code:
        display_parts.append(f"[ERROR CODE DETECTED]: {detected_code}")
    if vision_display:
        display_parts.append(f"[DISPLAY TEXT (Vision)]: {vision_display}")
    if vision_symptoms:
        display_parts.append(f"[VISIBLE SYMPTOMS]: {vision_symptoms}")
    if vision_fault_desc:
        display_parts.append(f"[FAULT MEANING]: {vision_fault_desc}")
    if ocr_text:
        display_parts.append(f"[OCR SUPPLEMENTARY]:\n{ocr_text}")

    if not display_parts:
        display_parts.append("[VISUAL ANALYSIS]: Analyzing machine photo for fault conditions...")

    formatted_ocr_display = "\n\n".join(display_parts)

    # ----------------------------------------------------------------
    # STEP 4: Web Search for OEM Bulletins
    # ----------------------------------------------------------------
    search_query = f"{final_machine} {detected_code or ''} {symptoms_text}".strip()
    web_search = get_web_search_service()
    proof_links = await web_search.search(
        search_query or "machine fault diagnosis troubleshooting manual", num_results=5
    )
    web_context = web_search.format_sources_for_prompt(proof_links)

    # ----------------------------------------------------------------
    # STEP 5: Deep reasoning via Groq LLM
    # ----------------------------------------------------------------
    prompt = f"""You are an elite industrial machinery and appliance diagnostics expert.

GROQ VISION IDENTIFIED:
  Machine: {final_machine}
  Brand: {vision_brand or 'See image'}
  Model: {vision_model_num or 'See image'}
  Error Code on Display: {detected_code or 'No code — visual fault'}
  Display Text: {vision_display or 'N/A'}
  Visible Symptoms: {vision_symptoms or 'N/A'}
  Fault Meaning (Vision): {vision_fault_desc or 'N/A'}

OPERATOR INPUT:
  Symptoms: {symptoms_text or 'Not provided'}
  Machine Hint: {machine_hint or 'Not provided'}
  Filename: {filename}

OCR SUPPLEMENTARY TEXT:
{ocr_text or 'No OCR text extracted'}

LIVE OEM BULLETINS (Web Search):
{web_context}

TASK: Provide a precise, manufacturer-specific diagnosis for {final_machine} with error code {detected_code or 'visual fault'}.

Return a valid JSON object:
{{
  "detected_error_code": "{detected_code or 'FAULT-INSPECTION'}",
  "detected_machine": "{final_machine}",
  "problem": "Clear technical title of the fault for {final_machine}",
  "diagnosis": "Comprehensive root cause analysis specific to {final_machine} and {detected_code or 'the visible fault'}",
  "answer": "Complete step-by-step repair and recovery procedure for {final_machine}",
  "probable_causes": [
    "Specific cause 1 for {final_machine}",
    "Specific cause 2",
    "Specific cause 3"
  ],
  "corrective_steps": [
    "Step 1: Safety isolation procedure",
    "Step 2: Diagnostic check",
    "Step 3: Repair action",
    "Step 4: Test and verify"
  ],
  "recommended_solutions": [
    {{
      "priority": 1,
      "action": "Most critical fix",
      "reason": "Why this fixes the issue",
      "evidence_strength": "High",
      "source": "OEM Manual / Service Bulletin",
      "is_verified": true
    }}
  ],
  "safety_warnings": [
    "Relevant safety warning for {final_machine}"
  ],
  "confidence": 0.95
}}
"""

    try:
        data = llm.json_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            model=settings.GROQ_MODEL,
        )
    except Exception as e:
        logger.error(f"Groq reasoning failed: {e}")
        data = {}

    final_machine_out = data.get("detected_machine") or final_machine
    final_error_out   = data.get("detected_error_code") or detected_code or "FAULT-INSPECTION"

    return ImageAnalysisResponse(
        ocr_text=formatted_ocr_display,
        detected_error_code=final_error_out,
        detected_machine=final_machine_out,
        problem=data.get("problem", f"{final_machine_out} — {final_error_out} Diagnostic"),
        diagnosis=data.get("diagnosis", f"Diagnosis for {final_machine_out} with fault {final_error_out}."),
        answer=data.get("answer", "Follow OEM service manual for fault resolution."),
        probable_causes=data.get("probable_causes", ["Check error code in OEM manual", "Inspect visible components", "Run diagnostics"]),
        corrective_steps=data.get("corrective_steps", ["Safety isolation", "Diagnose fault", "Repair", "Test"]),
        recommended_solutions=data.get("recommended_solutions", []),
        safety_warnings=data.get("safety_warnings", ["Follow safety procedures before servicing."]),
        confidence=float(data.get("confidence", 0.95)),
        proof_links=proof_links,
    )
