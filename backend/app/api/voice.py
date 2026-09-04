"""Voice Conversation with LLM API supporting Marathi, Hindi, and English."""

import io
import json
import logging
import os
import re
import urllib.parse
import uuid
from typing import Any, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
import httpx
from pydantic import BaseModel
import fitz  # PyMuPDF

from app.core.config import settings
from app.services.llm.openai_client import get_openai_client
from app.services.search.web_search import get_web_search_service

logger = logging.getLogger(__name__)

router = APIRouter()


class VoiceChatResponse(BaseModel):
    session_id: str
    query: str
    detected_language: str
    spoken_text: str
    display_text: str
    problem: str
    action_steps: list[str]
    safety_warning: str
    proof_links: list[dict[str, str]]
    has_document_context: bool
    audio_url: str


# Cache for voice sessions with document context
_voice_sessions: dict[str, dict[str, Any]] = {}


def detect_query_language(text: str, user_pref: Optional[str] = "auto") -> str:
    """Detect if query is Marathi, Hindi, or English based on keywords, Devanagari Unicode, and preference."""
    pref = (user_pref or "auto").lower()
    if pref in ["mr", "marathi"]:
        return "mr"
    if pref in ["hi", "hindi"]:
        return "hi"
    if pref in ["en", "english"]:
        return "en"

    # Distinctive Marathi words in Devanagari and Latin script
    marathi_markers = [
        "आहे", "नाही", "करा", "काय", "कसे", "करावे", "होते", "झाले", "मदत", "त्रुटी",
        "aahe", "nahi", "kara", "kay", "kase", "kasa", "madat", "truti", "hoil"
    ]
    # Distinctive Hindi markers
    hindi_markers = [
        "है", "नहीं", "करना", "क्या", "कैसे", "होगा", "हुआ", "मदद", "खराबी", "जांचें",
        "hai", "nahin", "karna", "kya", "kaise", "hoga", "hua", "madad", "kharabi"
    ]

    text_low = text.lower()
    if any(re.search(rf"\b{re.escape(m)}\b", text_low) for m in marathi_markers):
        return "mr"
    if any(re.search(rf"\b{re.escape(m)}\b", text_low) for m in hindi_markers):
        return "hi"

    # Check Devanagari script presence: U+0900 to U+097F
    has_devanagari = any("\u0900" <= c <= "\u097F" for c in text)
    if has_devanagari:
        # Default Devanagari to Marathi if user hinted or default to Hindi
        return "mr" if any(w in text for w in ["करा", "काय", "आहे", "कसे", "होते"]) else "hi"

    return "en"


@router.post("/chat", response_model=VoiceChatResponse)
async def voice_chat_endpoint(
    query: str = Form(...),
    language: Optional[str] = Form("auto"),
    session_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Handle conversational speech-to-text queries with live LLM reasoning in Marathi, Hindi, and English."""
    safe_session_id = session_id or str(uuid.uuid4())[:8]
    session_data = _voice_sessions.setdefault(safe_session_id, {"history": [], "doc_text": ""})

    # Process uploaded document if provided
    has_doc = bool(session_data.get("doc_text"))
    if file:
        content = await file.read()
        if content:
            fname = file.filename or "uploaded_manual.pdf"
            extracted_text = ""
            if fname.lower().endswith(".pdf"):
                try:
                    doc = fitz.open(stream=content, filetype="pdf")
                    for page in doc[:15]:
                        extracted_text += page.get_text() + "\n"
                    doc.close()
                except Exception as e:
                    logger.warning(f"Voice PDF extraction error: {e}")
            else:
                try:
                    extracted_text = content.decode("utf-8", errors="ignore")
                except Exception:
                    pass

            if extracted_text.strip():
                session_data["doc_text"] = extracted_text.strip()[:6000]
                has_doc = True
                logger.info(f"Voice session {safe_session_id}: loaded document context ({len(session_data['doc_text'])} chars)")

    # Language Determination
    lang = detect_query_language(query, language)

    # Search web proof links via Serper
    web_search = get_web_search_service()
    proof_links = await web_search.search(f"{query} industrial machine troubleshooting", num_results=4)
    web_context = web_search.format_sources_for_prompt(proof_links)

    # Construct multilingual voice prompt
    doc_context_snippet = session_data.get("doc_text", "")
    if doc_context_snippet:
        doc_prompt_block = f"\n--- EXTRACTED USER DOCUMENT / MANUAL CONTENT ---\n{doc_context_snippet[:2500]}\n-------------------------------------------------\n"
    else:
        doc_prompt_block = "\n(No document uploaded. Use general factory equipment knowledge and OEM bulletins.)\n"

    lang_instruction = ""
    if lang == "mr":
        lang_instruction = (
            "LANGUAGE REQUIREMENT (CRITICAL): The user is speaking in MARATHI (मराठी). "
            "You MUST formulate your response in fluent, natural, respectful MARATHI (मराठी) using the Devanagari script. "
            "For example, 'नमस्कार, तुमच्या मशीनच्या समस्येचे निराकरण करण्यासाठी...' "
            "The 'spoken_text' field MUST be in smooth Marathi suitable for Marathi Text-to-Speech (TTS)."
        )
    elif lang == "hi":
        lang_instruction = (
            "LANGUAGE REQUIREMENT (CRITICAL): The user is speaking in HINDI (हिंदी). "
            "You MUST formulate your response in natural, authoritative HINDI (हिंदी) using the Devanagari script. "
            "For example, 'नमस्ते, आपकी मशीन के फॉल्ट को ठीक करने के लिए निम्नलिखित कदम उठाएं...' "
            "The 'spoken_text' field MUST be in smooth Hindi suitable for Hindi Text-to-Speech (TTS)."
        )
    else:
        lang_instruction = (
            "LANGUAGE REQUIREMENT: Respond in clear, professional English. "
            "The 'spoken_text' field should be conversational, authoritative, and natural when spoken aloud by browser TTS."
        )

    prompt = f"""You are 'Arjuna Voice Tech' — an advanced industrial AI diagnostic assistant designed for voice-driven factory maintenance.
{lang_instruction}

User Voice Query: "{query}"
Session ID: {safe_session_id}
{doc_prompt_block}

Verified OEM Bulletins from Live Search:
{web_context}

RULES FOR VOICE OUTPUT:
1. 'spoken_text' is strictly for speech synthesis:
   - Make it sound like an expert engineer talking over an intercom or headset.
   - Do NOT include markdown stars (*), bullet dashes (-), numbered lists, code blocks, or URLs in 'spoken_text'.
   - Keep it concise (2-4 conversational sentences summarizing the diagnosis and immediate action).
2. 'display_text' is the visual card explanation shown on the technician's screen.
3. Provide 3-4 structured 'action_steps'.
4. Provide a clear 'safety_warning' (Lockout/Tagout, high voltage, or hot surfaces).

Return a valid JSON object matching this schema:
{{
  "problem": "Clear title of the fault or inquiry",
  "spoken_text": "Spoken reply text in the requested language (no markdown, natural conversational speech)",
  "display_text": "Detailed visual card text explaining the fault mechanism and root cause",
  "action_steps": [
    "Step 1: Check power supply and LOTO isolation",
    "Step 2: Inspect wiring / sensor calibration",
    "Step 3: Reset alarm and test run"
  ],
  "safety_warning": "Important safety and LOTO precaution in the chosen language"
}}
"""

    llm = get_openai_client()
    try:
        data = llm.json_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            model=settings.GROQ_MODEL,
        )
    except Exception as e:
        logger.error(f"Voice chat Groq error: {e}")
        data = {}

    spoken_text = data.get("spoken_text") or (
        "मशीनची तपासणी करण्यासाठी कृपया प्रथम वीज पुरवठा बंद करा आणि सेन्सर तपासा." if lang == "mr" else \
        "मशीन की खराबी दूर करने के लिए कृपया पहले मेन पावर बंद करें और सेंसर की जांच करें।" if lang == "hi" else \
        "Please isolate the power supply following lockout tagout protocols and inspect the primary sensor connections."
    )

    display_text = data.get("display_text") or spoken_text
    problem = data.get("problem") or query

    action_steps = data.get("action_steps") or [
        "Verify emergency stop and lockout-tagout (LOTO) isolation",
        "Inspect electrical continuity and mechanical clearance",
        "Conduct diagnostic test run after clearing alarm",
    ]

    safety_warning = data.get("safety_warning") or (
        "धोका: मशीन उघडण्यापूर्वी लॉकआऊट-टॅगआऊट (LOTO) नियमांचे काटेकोर पालन करा." if lang == "mr" else \
        "सावधानी: मशीन पर काम करने से पहले लॉकआउट-टैगआउट (LOTO) नियमों का पालन करें।" if lang == "hi" else \
        "DANGER: Adhere to OSHA 1910.147 Lockout/Tagout (LOTO) isolation before servicing equipment."
    )

    # Save to session history
    session_data["history"].append({"role": "user", "text": query})
    session_data["history"].append({"role": "assistant", "text": display_text})

    # Generate direct audio URL
    encoded_text = urllib.parse.quote(spoken_text[:400])
    audio_url = f"/api/voice/tts?lang={lang}&text={encoded_text}"

    return VoiceChatResponse(
        session_id=safe_session_id,
        query=query,
        detected_language=lang,
        spoken_text=spoken_text,
        display_text=display_text,
        problem=problem,
        action_steps=action_steps,
        safety_warning=safety_warning,
        proof_links=proof_links,
        has_document_context=has_doc,
        audio_url=audio_url,
    )


@router.get("/tts")
async def stream_spoken_audio(text: str, lang: str = "mr"):
    """Generate and stream natural spoken audio (MP3) in Marathi, Hindi, or English using ElevenLabs with fallback."""
    clean_text = text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text parameter required")

    # 1. Primary: ElevenLabs Multilingual V2 (Studio-grade neural speech for Marathi and Hindi)
    if settings.ELEVENLABS_API_KEY:
        voice_ids = [
            settings.ELEVENLABS_VOICE_ID,
            settings.ELEVENLABS_FALLBACK_VOICE_ID,
        ]
        for vid in voice_ids:
            if not vid:
                continue
            eleven_url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
            eleven_headers = {
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            }
            eleven_payload = {
                "text": clean_text[:450],
                "model_id": settings.ELEVENLABS_MODEL_ID,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.8,
                },
            }
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(eleven_url, json=eleven_payload, headers=eleven_headers)
                    if resp.status_code == 200 and resp.content:
                        logger.info(f"ElevenLabs TTS succeeded using voice {vid} ({len(resp.content)} bytes)")
                        return Response(
                            content=resp.content,
                            media_type="audio/mpeg",
                            headers={
                                "Content-Disposition": 'inline; filename="elevenlabs_voice.mp3"',
                                "Cache-Control": "public, max-age=3600",
                                "X-TTS-Engine": "ElevenLabs",
                                "X-TTS-Voice": vid,
                            },
                        )
                    else:
                        logger.warning(f"ElevenLabs voice {vid} returned {resp.status_code}: {resp.text[:120]}")
            except Exception as e:
                logger.warning(f"ElevenLabs connection error for voice {vid}: {e}")

    # 2. Fallback: Multi-chunk streaming audio
    tl = "mr" if lang in ["mr", "marathi"] else "hi" if lang in ["hi", "hindi"] else "en"

    raw_sentences = re.split(r"[।\.\?!,\n]+", clean_text)
    chunks: list[str] = []
    current_chunk = ""

    for s in raw_sentences:
        s = s.strip()
        if not s:
            continue
        if len(current_chunk) + len(s) + 1 < 120:
            current_chunk = f"{current_chunk} {s}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = s[:110]
    if current_chunk:
        chunks.append(current_chunk)

    if not chunks:
        chunks = [clean_text[:110]]

    chunks = chunks[:4]

    tts_url = "https://translate.google.com/translate_tts"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    all_audio_bytes = b""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            for chunk in chunks:
                params = {"ie": "UTF-8", "q": chunk, "tl": tl, "client": "tw-ob"}
                r = await client.get(tts_url, params=params, headers=headers)
                if r.status_code == 200 and r.content:
                    all_audio_bytes += r.content
    except Exception as e:
        logger.warning(f"Error fetching fallback TTS audio chunks: {e}")

    if all_audio_bytes:
        return Response(
            content=all_audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="voice.mp3"',
                "Cache-Control": "public, max-age=3600",
                "X-TTS-Engine": "Fallback",
            },
        )

    raise HTTPException(status_code=502, detail="Audio generation failed")
