"""Image Analysis & Error Solving API — Groq Vision-First.

Architecture:
  1. Send image directly to Groq Vision via vision_completion() → plain text JSON
  2. Parse vision result → machine name, brand, error code, display text
  3. Run OCR as supplementary (catches text vision may miss)
  4. Merge all signals → best machine + error code
  5. Web search for OEM bulletins
  6. Final LLM reasoning with full context
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
# Vision: send image directly to Groq Vision model
# ---------------------------------------------------------------------------

def _extract_json_from_text(text: str) -> dict:
    """Robustly extract JSON dict from LLM text response."""
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # Strip markdown code fences
    for fence in ["```json", "```"]:
        if fence in text:
            parts = text.split(fence)
            for part in parts:
                cleaned = part.split("```")[0].strip()
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass

    # Extract first {...} block
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    logger.warning(f"Could not parse JSON from vision response: {text[:200]}")
    return {}


async def groq_vision_identify(
    content: bytes,
    filename: str,
    symptoms: Optional[str],
    machine_hint: Optional[str],
    llm,
) -> dict:
    """
    Send raw image to Groq Vision and extract machine identity + fault information.
    Uses vision_completion() which correctly handles multimodal Groq API calls.
    """
    # Convert to base64
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
    mime_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "webp": "image/webp",
        "gif": "image/gif", "bmp": "image/png",
    }
    mime_type = mime_map.get(ext, "image/jpeg")
    image_b64 = base64.b64encode(content).decode("utf-8")

    hint_ctx = ""
    if machine_hint and machine_hint.strip():
        hint_ctx += f"\nOperator machine hint: {machine_hint.strip()}"
    if symptoms and symptoms.strip():
        hint_ctx += f"\nOperator-reported symptoms: {symptoms.strip()}"

    vision_prompt = f"""You are an expert industrial machinery and appliance diagnostics AI.
Carefully examine this image and identify EVERYTHING visible.{hint_ctx}

Look for:
- Brand/manufacturer name (on logo, badge, nameplate, or label)
- Machine type (washing machine, sewing machine, CNC machine, VFD drive, refrigerator, AC unit, robot, etc.)
- Model number (on label or display)
- ANY error/fault code on the display (e.g. F21, E01, ALARM 3, ERR-04, A011)
- ALL text visible on display panels, buttons, or labels
- Physical condition: LED colors, damage, wear

Return ONLY a JSON object with these exact fields (no extra text, no markdown):
{{
  "brand": "exact brand name or null",
  "machine_type": "type of machine",
  "model": "model number or null",
  "full_machine_name": "Brand + Type + Model (e.g. Whirlpool Front Load Washing Machine WFW5000FW, or Juki DDL-8700 Industrial Sewing Machine)",
  "error_code": "EXACT code on display (e.g. F21, E3, ALARM-5) or null",
  "display_text": "all text visible on any display or label",
  "visible_symptoms": "physical observations: LED state, damage, component condition",
  "fault_description": "what this error code means for this specific machine",
  "confidence": 0.9
}}
"""

    try:
        raw_text = llm.vision_completion(
            prompt=vision_prompt,
            image_base64=image_b64,
            mime_type=mime_type,
        )
        result = _extract_json_from_text(raw_text)
        if result:
            logger.info(
                f"Vision identified: machine='{result.get('full_machine_name')}', "
                f"error='{result.get('error_code')}'"
            )
        else:
            logger.warning(f"Vision returned empty result. Raw: {raw_text[:300]}")
        return result
    except Exception as e:
        logger.error(f"Groq Vision identification failed: {e}")
        return {}


# ---------------------------------------------------------------------------
# OCR: supplementary text extraction (never primary)
# ---------------------------------------------------------------------------

def normalize_error_code(raw: str) -> str:
    code = raw.strip().upper()
    if re.match(r"^[FEA]\s*[O0-9]{2,5}$", code):
        prefix = code[0]
        digits = re.sub(r"[^0-9O]", "", code[1:]).replace("O", "0").replace("I", "1")
        return f"{prefix}{digits}"
    if re.match(r"^ERR[-_\s]*[O0-9]{2,5}$", code):
        digits = re.sub(r"[^0-9]", "", code[3:])
        return f"ERR-{digits}"
    if re.match(r"^ALARM\s*[0-9]{1,4}$", code):
        digits = re.sub(r"[^0-9]", "", code[5:])
        return f"ALARM {digits}"
    return code


def is_gibberish(line: str) -> bool:
    clean = line.strip()
    if not clean or len(clean) < 2:
        return True
    if re.search(
        r"\b(?:[A-Z]\d{2,5}|ALARM|FAULT|ERR|ERROR|WARN|CODE|MOTOR|DRIVE|TEMP|OVER|PRESS)\b",
        clean, re.I
    ):
        return False
    words = clean.split()
    short = sum(1 for w in words if len(re.sub(r"[^a-zA-Z0-9]", "", w)) <= 2)
    if len(words) >= 2 and short / len(words) >= 0.70:
        return True
    alnum = sum(1 for c in clean if c.isalnum() or c.isspace())
    if len(clean) > 5 and alnum / len(clean) < 0.55:
        return True
    return False


def perform_ocr(content: bytes) -> tuple[str, list[str]]:
    """Multi-pass OCR — supplementary to Vision, not primary."""
    raw_blocks: list[str] = []
    error_codes: list[str] = []

    if OPENCV_AVAILABLE:
        try:
            nparr = np.frombuffer(content, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                # Scale up 2.5x for better text recognition
                img = cv2.resize(img, (0, 0), fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

                # PASS A: Red LED display isolation
                b, g, r = cv2.split(img)
                red_mask = np.clip(
                    r.astype(np.int16) - ((g.astype(np.int16) + b.astype(np.int16)) // 2),
                    0, 255
                ).astype(np.uint8)
                _, red_thresh = cv2.threshold(red_mask, 35, 255, cv2.THRESH_BINARY)
                k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
                red_closed = cv2.morphologyEx(red_thresh, cv2.MORPH_CLOSE, k)
                t = pytesseract.image_to_string(
                    cv2.bitwise_not(red_closed),
                    config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_"
                )
                if t.strip():
                    raw_blocks.append(t.strip())

                # PASS B: CLAHE enhanced grayscale
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                t2 = pytesseract.image_to_string(enhanced, config="--psm 6")
                if t2.strip():
                    raw_blocks.append(t2.strip())

                # PASS C: Adaptive threshold for printed labels/nameplates
                adapt = cv2.adaptiveThreshold(
                    enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5
                )
                t3 = pytesseract.image_to_string(adapt, config="--psm 11")
                if t3.strip():
                    raw_blocks.append(t3.strip())

        except Exception as e:
            logger.warning(f"OpenCV OCR error: {e}")

    if not raw_blocks:
        try:
            pil = Image.open(io.BytesIO(content)).convert("L")
            pil = pil.resize((pil.width * 2, pil.height * 2), Image.Resampling.BICUBIC)
            pil = ImageEnhance.Contrast(pil).enhance(2.0)
            raw_blocks.append(pytesseract.image_to_string(pil, config="--psm 6"))
            raw_blocks.append(pytesseract.image_to_string(ImageOps.invert(pil), config="--psm 7"))
        except Exception as e:
            logger.warning(f"PIL OCR error: {e}")

    all_text = "\n".join(raw_blocks)

    # Extract error codes from OCR text
    for m in re.findall(
        r"\b(?:[FEA]\s*[O0-9]{2,5}|ERR[-:\s]*[0-9]{2,4}|ALARM\s*[0-9]{1,4}|0x[0-9A-Fa-f]{2,6})\b",
        all_text, re.IGNORECASE
    ):
        norm = normalize_error_code(m)
        if norm not in error_codes and len(norm) >= 3:
            error_codes.append(norm)

    # Filter gibberish lines
    clean_lines, seen = [], set()
    for block in raw_blocks:
        for line in block.split("\n"):
            ls = line.strip()
            if not is_gibberish(ls) and ls not in seen:
                seen.add(ls)
                clean_lines.append(ls)

    return "\n".join(clean_lines).strip(), error_codes


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=ImageAnalysisResponse)
async def analyze_image_and_solve_error(
    file: UploadFile = File(...),
    symptoms: Optional[str] = Form(None),
    machine_hint: Optional[str] = Form(None),
):
    """Analyze uploaded machine image using Groq Vision (primary) + OCR (supplementary)."""
    if not file:
        raise HTTPException(status_code=400, detail="Image file is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file received")

    filename = file.filename or "machine_photo.jpg"
    symptoms_text = (symptoms or "").strip()
    llm = get_openai_client()

    # ----------------------------------------------------------------
    # STEP 1: Groq Vision — PRIMARY identification (reads image directly)
    # ----------------------------------------------------------------
    vision_data = await groq_vision_identify(content, filename, symptoms_text, machine_hint, llm)

    vision_machine    = vision_data.get("full_machine_name") or ""
    vision_brand      = vision_data.get("brand") or ""
    vision_model_num  = vision_data.get("model") or ""
    vision_error      = vision_data.get("error_code") or ""
    vision_display    = vision_data.get("display_text") or ""
    vision_symptoms_v = vision_data.get("visible_symptoms") or ""
    vision_fault_desc = vision_data.get("fault_description") or ""

    # ----------------------------------------------------------------
    # STEP 2: OCR — SUPPLEMENTARY (never overrides vision)
    # ----------------------------------------------------------------
    ocr_text, ocr_codes = perform_ocr(content)

    # ----------------------------------------------------------------
    # STEP 3: Determine best error code and machine name
    # ----------------------------------------------------------------

    # Error code priority: vision > symptoms text > OCR
    symptom_codes = [
        normalize_error_code(c) for c in re.findall(
            r"\b(?:[FEA]\s*[O0-9]{2,5}|ERR[-:\s]*[0-9]{2,4}|ALARM\s*[0-9]{1,4})\b",
            f"{symptoms_text} {filename}", re.IGNORECASE
        )
    ]

    if vision_error and vision_error.strip().lower() not in ("null", "none", ""):
        detected_code = normalize_error_code(vision_error)
    elif symptom_codes:
        detected_code = symptom_codes[0]
    elif ocr_codes:
        detected_code = ocr_codes[0]
    else:
        detected_code = None

    # Machine priority: vision > machine_hint > "Unknown Machine"
    if vision_machine and vision_machine.strip().lower() not in ("null", "none", "unknown", ""):
        final_machine = vision_machine.strip()
    elif machine_hint and machine_hint.strip():
        final_machine = machine_hint.strip()
    else:
        final_machine = "Unknown Machine"

    # ----------------------------------------------------------------
    # STEP 4: Build display text for UI
    # ----------------------------------------------------------------
    display_parts = []
    if vision_machine:
        display_parts.append(f"[VISION IDENTIFIED MACHINE]: {vision_machine}")
    if vision_brand:
        display_parts.append(f"[BRAND]: {vision_brand}")
    if detected_code:
        display_parts.append(f"[ERROR CODE ON DISPLAY]: {detected_code}")
    if vision_display:
        display_parts.append(f"[DISPLAY TEXT (Vision)]: {vision_display}")
    if vision_symptoms_v:
        display_parts.append(f"[VISIBLE SYMPTOMS]: {vision_symptoms_v}")
    if vision_fault_desc:
        display_parts.append(f"[FAULT MEANING]: {vision_fault_desc}")
    if ocr_text:
        display_parts.append(f"[OCR SUPPLEMENTARY TEXT]:\n{ocr_text}")

    if not display_parts:
        display_parts.append("[VISION ANALYSIS]: Analyzing machine photo for fault conditions...")

    formatted_display = "\n\n".join(display_parts)

    # ----------------------------------------------------------------
    # STEP 5: Web search for OEM bulletins
    # ----------------------------------------------------------------
    search_query = f"{final_machine} {detected_code or ''} {symptoms_text}".strip()
    web_search = get_web_search_service()
    proof_links = await web_search.search(
        search_query or "machine fault diagnosis troubleshooting", num_results=5
    )
    web_context = web_search.format_sources_for_prompt(proof_links)

    # ----------------------------------------------------------------
    # STEP 6: Deep LLM reasoning — machine-specific diagnosis
    # ----------------------------------------------------------------
    reasoning_prompt = f"""You are an elite machinery and appliance diagnostics expert.

MACHINE IDENTIFIED BY VISION AI:
  Full Name: {final_machine}
  Brand: {vision_brand or 'See image'}
  Model: {vision_model_num or 'See image'}
  Error Code on Display: {detected_code or 'No code visible — visual fault analysis'}
  Display Text Read by Vision: {vision_display or 'N/A'}
  Visible Physical Symptoms: {vision_symptoms_v or 'N/A'}
  Vision AI Fault Assessment: {vision_fault_desc or 'N/A'}

OPERATOR INPUT:
  Reported Symptoms: {symptoms_text or 'Not provided'}
  Machine Hint: {machine_hint or 'Not provided'}

OCR SUPPLEMENTARY TEXT: {ocr_text or 'N/A'}

OEM BULLETINS FROM WEB SEARCH:
{web_context}

TASK: Provide a precise, {final_machine}-specific engineering diagnosis.
For error code {detected_code or 'the visible fault'}, explain:
- The exact physical/electrical root cause for THIS specific machine
- Manufacturer-specific repair steps
- Part numbers or settings where known

Return ONLY a JSON object:
{{
  "detected_error_code": "{detected_code or 'FAULT-INSPECTION'}",
  "detected_machine": "{final_machine}",
  "problem": "Specific fault title for {final_machine}",
  "diagnosis": "Root cause analysis specific to {final_machine} and {detected_code or 'visible fault'}",
  "answer": "Complete step-by-step repair procedure for {final_machine}",
  "probable_causes": [
    "Cause 1 specific to {final_machine}",
    "Cause 2",
    "Cause 3"
  ],
  "corrective_steps": [
    "Step 1: Safety isolation",
    "Step 2: Specific diagnostic check",
    "Step 3: Repair action",
    "Step 4: Test and verify"
  ],
  "recommended_solutions": [
    {{
      "priority": 1,
      "action": "Primary fix for {final_machine}",
      "reason": "Root cause addressed",
      "evidence_strength": "High",
      "source": "OEM Service Manual",
      "is_verified": true
    }}
  ],
  "safety_warnings": [
    "Safety warning specific to {final_machine}"
  ],
  "confidence": 0.95
}}
"""

    try:
        data = llm.json_completion(
            messages=[{"role": "user", "content": reasoning_prompt}],
            temperature=0.1,
            model=settings.GROQ_MODEL,
        )
    except Exception as e:
        logger.error(f"LLM reasoning failed: {e}")
        data = {}

    return ImageAnalysisResponse(
        ocr_text=formatted_display,
        detected_error_code=data.get("detected_error_code") or detected_code or "FAULT-INSPECTION",
        detected_machine=data.get("detected_machine") or final_machine,
        problem=data.get("problem", f"{final_machine} — Fault Diagnosis"),
        diagnosis=data.get("diagnosis", f"Diagnosis for {final_machine}."),
        answer=data.get("answer", "Follow OEM service manual for repair."),
        probable_causes=data.get("probable_causes", ["See OEM manual", "Inspect display code", "Check components"]),
        corrective_steps=data.get("corrective_steps", ["Safety isolation", "Diagnose fault", "Repair", "Test"]),
        recommended_solutions=data.get("recommended_solutions", []),
        safety_warnings=data.get("safety_warnings", ["Follow safety procedures before servicing."]),
        confidence=float(data.get("confidence", 0.95)),
        proof_links=proof_links,
    )
