"""Translation API route using RapidAPI Google Translate 113 with Groq LLM fallback and persistent caching."""

import json
import logging
import os
from typing import Any, Dict, List, Optional, Union
import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory translation cache to save quota and speed up repeated requests
# Key: (text, source_lang, target_lang) -> Value: translated_text
TRANSLATION_CACHE: Dict[tuple, str] = {}

LANGUAGE_NAMES: Dict[str, str] = {
    "hi": "Hindi", "mr": "Marathi", "bn": "Bengali", "te": "Telugu", "ta": "Tamil",
    "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi", "or": "Odia",
    "as": "Assamese", "ur": "Urdu", "sa": "Sanskrit", "ne": "Nepali", "kok": "Konkani",
    "es": "Spanish", "fr": "French", "de": "German", "it": "Italian", "pt": "Portuguese",
    "ru": "Russian", "zh": "Chinese (Simplified)", "zh-tw": "Chinese (Traditional)",
    "ja": "Japanese", "ko": "Korean", "ar": "Arabic", "nl": "Dutch", "tr": "Turkish",
    "pl": "Polish", "sv": "Swedish", "id": "Indonesian", "vi": "Vietnamese", "th": "Thai",
    "el": "Greek", "cs": "Czech", "da": "Danish", "fi": "Finnish", "no": "Norwegian",
    "hu": "Hungarian", "ro": "Romanian", "uk": "Ukrainian", "he": "Hebrew", "fa": "Persian",
    "ms": "Malay", "tl": "Filipino", "sk": "Slovak", "bg": "Bulgarian", "hr": "Croatian",
    "sr": "Serbian", "lt": "Lithuanian", "sl": "Slovenian", "lv": "Latvian", "et": "Estonian",
    "ga": "Irish", "is": "Icelandic", "sw": "Swahili", "af": "Afrikaans", "sq": "Albanian",
    "hy": "Armenian", "az": "Azerbaijani", "eu": "Basque", "be": "Belarusian", "bs": "Bosnian",
    "ca": "Catalan", "ka": "Georgian", "kk": "Kazakh", "mk": "Macedonian", "mn": "Mongolian",
    "uz": "Uzbek", "en": "English"
}

# Built-in translations for core UI strings as resilient fallback
FALLBACK_DICTIONARY: Dict[str, Dict[str, str]] = {
    "hi": {
        "Machine Troubleshooter": "मशीन समस्या निवारक",
        "Chatbot": "चैटबॉट",
        "Process Flow": "प्रक्रिया प्रवाह",
        "What-If Simulator": "व्हाट-इफ सिम्युलेटर",
        "Image Analysis": "छवि विश्लेषण",
        "Voice Assistant": "वॉयस असिस्टेंट",
        "Document Intelligence": "दस्तावेज़ इंटेलिजेंस",
        "Error Research": "त्रुटि अनुसंधान",
        "Industrial Diagnostic Assistant": "औद्योगिक निदान सहायक",
        "Upload Service Manual": "सर्विस मैनुअल अपलोड करें",
        "Upload Manual": "मैनुअल अपलोड करें",
        "Select & Upload Manual": "मैनुअल चुनें और अपलोड करें",
        "Active Knowledge Base": "सक्रिय ज्ञानकोष",
        "Diagnostic System Online": "निदान प्रणाली ऑनलाइन",
        "Download PDF Report": "पीडीएफ रिपोर्ट डाउनलोड करें",
        "View HTML Report": "एचटीएमएल रिपोर्ट देखें",
        "Run": "चलाएं",
        "Step": "चरण",
        "Previous": "पिछला",
        "Next": "अगला",
        "Clear": "साफ़ करें",
        "Mandatory Safety Precautions": "अनिवार्य सुरक्षा सावधानियां",
        "HIGH Confidence": "उच्च विश्वसनीयता",
        "MEDIUM Confidence": "मध्यम विश्वसनीयता",
        "LOW Confidence": "कम विश्वसनीयता",
    },
    "mr": {
        "Machine Troubleshooter": "मशिन समस्या निवारक",
        "Chatbot": "चॅटबॉट",
        "Process Flow": "प्रक्रिया प्रवाह",
        "What-If Simulator": "व्हॉट-इफ सिम्युलेटर",
        "Image Analysis": "प्रतिमा विश्लेषण",
        "Voice Assistant": "व्हॉइस असिस्टंट",
        "Industrial Diagnostic Assistant": "औद्योगिक निदान सहाय्यक",
        "Upload Service Manual": "सर्व्हिस मॅन्युअल अपलोड करा",
        "Upload Manual": "मॅन्युअल अपलोड करा",
        "Active Knowledge Base": "सक्रिय ज्ञानकोष",
        "Diagnostic System Online": "निदान प्रणाली ऑनलाइन",
        "Download PDF Report": "पीडीएफ अहवाल डाउनलोड करा",
        "View HTML Report": "एचटीएमएल अहवाल पहा",
        "Mandatory Safety Precautions": "अनिवार्य सुरक्षा खबरदारी",
        "HIGH Confidence": "उच्च विश्वासार्हता",
    },
    "es": {
        "Machine Troubleshooter": "Solucionador de Problemas de Máquinas",
        "Chatbot": "Chatbot",
        "Process Flow": "Flujo del Proceso",
        "What-If Simulator": "Simulador What-If",
        "Image Analysis": "Análisis de Imágenes",
        "Industrial Diagnostic Assistant": "Asistente de Diagnóstico Industrial",
        "Upload Service Manual": "Cargar Manual de Servicio",
        "Upload Manual": "Cargar Manual",
        "Diagnostic System Online": "Sistema de Diagnóstico en Línea",
        "Download PDF Report": "Descargar Informe en PDF",
        "View HTML Report": "Ver Informe en HTML",
        "HIGH Confidence": "Alta Confianza",
    },
    "fr": {
        "Machine Troubleshooter": "Dépannage de Machines Industrielles",
        "Chatbot": "Chatbot",
        "Process Flow": "Flux de Processus",
        "Industrial Diagnostic Assistant": "Assistant de Diagnostic Industriel",
        "Upload Service Manual": "Téléverser le Manuel",
        "Diagnostic System Online": "Système de Diagnostic en Ligne",
        "Download PDF Report": "Télécharger le Rapport PDF",
        "View HTML Report": "Voir le Rapport HTML",
        "HIGH Confidence": "Confiance Élevée",
    },
    "de": {
        "Machine Troubleshooter": "Industrie-Maschinen-Fehlerbehebung",
        "Chatbot": "Chatbot",
        "Process Flow": "Prozessablauf",
        "Industrial Diagnostic Assistant": "Industrieller Diagnose-Assistent",
        "Upload Service Manual": "Servicehandbuch hochladen",
        "Diagnostic System Online": "Diagnosesystem Online",
        "Download PDF Report": "PDF-Bericht herunterladen",
        "View HTML Report": "HTML-Bericht anzeigen",
        "HIGH Confidence": "Hohe Zuverlässigkeit",
    },
}

CACHE_FILE = os.path.join(settings.MANUALS_DIR, "translations_cache.json")


def load_disk_cache():
    """Load cached translations from disk file."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k, v in data.items():
                    parts = k.split(":::")
                    if len(parts) == 3:
                        TRANSLATION_CACHE[(parts[0], parts[1], parts[2])] = v
        except Exception as e:
            logger.warning(f"Could not load disk translation cache: {e}")


def save_disk_cache():
    """Save in-memory cache to disk."""
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        serializable = {f"{k[0]}:::{k[1]}:::{k[2]}": v for k, v in TRANSLATION_CACHE.items()}
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Could not save disk translation cache: {e}")


load_disk_cache()


class TranslateRequest(BaseModel):
    q: Union[str, List[str]] = Field(..., description="Text or list of texts to translate")
    source: str = Field(default="auto", description="Source language code (default 'auto' or 'en')")
    target: str = Field(..., description="Target language code (e.g. 'es', 'fr', 'hi', 'vi')")


class TranslateResponse(BaseModel):
    translated_text: Union[str, List[str]]
    source: str
    target: str
    provider: str


async def call_rapidapi_google_translate_json(
    texts_dict: Dict[str, str],
    source: str,
    target: str,
) -> Dict[str, str]:
    """Call Google Translate 113 RapidAPI JSON translator endpoint.

    Endpoint: POST https://google-translate113.p.rapidapi.com/api/v1/translator/json
    Headers:
      x-rapidapi-host: google-translate113.p.rapidapi.com
      x-rapidapi-key: <key>
    """
    url = f"{settings.RAPIDAPI_TRANSLATE_URL.rstrip('/')}/json"
    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-host": settings.RAPIDAPI_TRANSLATE_HOST,
        "x-rapidapi-key": settings.RAPIDAPI_TRANSLATE_KEY,
    }
    payload = {
        "from": source or "auto",
        "to": target,
        "protected_paths": [],
        "common_protected_paths": [],
        "json": texts_dict,
    }

    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                trans_data = (
                    data.get("trans")
                    or data.get("result")
                    or data.get("json")
                    or (data if isinstance(data, dict) and not any(k in data for k in ["message", "error"]) else {})
                )
                if isinstance(trans_data, dict) and trans_data:
                    return {str(k): str(v) for k, v in trans_data.items()}
            else:
                logger.debug(f"RapidAPI Google Translate returned {resp.status_code}: {resp.text[:120]}")
    except Exception as e:
        logger.debug(f"RapidAPI Google Translate request error: {e}")

    return {}


async def call_rapidapi_google_translate_text(
    text: str,
    source: str,
    target: str,
) -> Optional[str]:
    """Call Google Translate 113 RapidAPI text translator endpoint."""
    url = f"{settings.RAPIDAPI_TRANSLATE_URL.rstrip('/')}/text"
    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-host": settings.RAPIDAPI_TRANSLATE_HOST,
        "x-rapidapi-key": settings.RAPIDAPI_TRANSLATE_KEY,
    }
    payload = {
        "from": source or "auto",
        "to": target,
        "text": text,
    }

    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                trans = data.get("trans") or data.get("translated_text") or data.get("result")
                if trans:
                    return str(trans)
    except Exception as e:
        logger.debug(f"RapidAPI text translation error: {e}")

    return None


def translate_with_groq_batch(texts: List[str], source: str, target: str) -> List[str]:
    """Translate a list of strings using the Groq LLM inference engine with structured key-value mapping."""
    if not texts:
        return []
    lang_name = LANGUAGE_NAMES.get(target.lower(), target)
    indexed_input = {str(i): text for i, text in enumerate(texts)}
    try:
        from app.services.llm.openai_client import get_openai_client
        client = get_openai_client()
        prompt = (
            f"You are a professional industrial UI translator.\n"
            f"Translate each text value from English into {lang_name} ({target}).\n"
            f"CRITICAL RULES:\n"
            f"1. Preserve error codes (e.g. E101), machine models (e.g. RC10, CNC-X100), technical numbers, and units.\n"
            f"2. Return a valid JSON object mapping each index key ('0', '1', ...) directly to its translated string.\n\n"
            f"Input:\n{json.dumps(indexed_input, ensure_ascii=False)}"
        )
        res = client.json_completion([{"role": "user", "content": prompt}], model="openai/gpt-oss-20b")
        if isinstance(res, dict):
            data = res.get("translations", res) if isinstance(res.get("translations"), dict) else res
            translated_list = []
            for i, orig in enumerate(texts):
                val = data.get(str(i)) or data.get(i)
                if val and isinstance(val, str) and val.strip():
                    translated_list.append(val.strip())
                else:
                    fallback = FALLBACK_DICTIONARY.get(target.lower(), {}).get(orig, orig)
                    translated_list.append(fallback)
            return translated_list
    except Exception as e:
        logger.error(f"Groq batch translation failed: {e}")

    lang_dict = FALLBACK_DICTIONARY.get(target.lower(), {})
    return [lang_dict.get(t, t) for t in texts]


@router.post("", response_model=TranslateResponse)
async def translate_text(req: TranslateRequest):
    """Translate one or multiple texts into target language using Google Translate 113 with Groq fallback."""
    if req.target.lower() in [req.source.lower(), "en" if req.source.lower() == "auto" else ""]:
        return TranslateResponse(
            translated_text=req.q,
            source=req.source,
            target=req.target,
            provider="identity",
        )

    # 1. Single string translation
    if isinstance(req.q, str):
        cache_key = (req.q, req.source.lower(), req.target.lower())
        if cache_key in TRANSLATION_CACHE:
            return TranslateResponse(
                translated_text=TRANSLATION_CACHE[cache_key],
                source=req.source,
                target=req.target,
                provider="cache",
            )

        # Check local dictionary
        lang_dict = FALLBACK_DICTIONARY.get(req.target.lower(), {})
        if req.q in lang_dict:
            return TranslateResponse(
                translated_text=lang_dict[req.q],
                source=req.source,
                target=req.target,
                provider="dictionary",
            )

        # Attempt RapidAPI Google Translate 113
        translated = await call_rapidapi_google_translate_text(req.q, req.source, req.target)
        if not translated:
            json_res = await call_rapidapi_google_translate_json({"0": req.q}, req.source, req.target)
            translated = json_res.get("0")

        # Fallback to Groq LLM
        if not translated or translated.strip() == req.q.strip():
            groq_res = translate_with_groq_batch([req.q], req.source, req.target)
            translated = groq_res[0] if groq_res else req.q

        if translated and translated.strip() != req.q.strip():
            TRANSLATION_CACHE[cache_key] = translated
            save_disk_cache()

        return TranslateResponse(
            translated_text=translated,
            source=req.source,
            target=req.target,
            provider="rapidapi_google_or_groq",
        )

    # 2. Batch list translation
    source_lower = req.source.lower()
    target_lower = req.target.lower()
    results: List[str] = [""] * len(req.q)
    uncached_indices: List[int] = []
    uncached_texts: List[str] = []

    # Step A: Fill from in-memory cache and static dictionary
    lang_dict = FALLBACK_DICTIONARY.get(target_lower, {})
    for idx, item in enumerate(req.q):
        cache_key = (item, source_lower, target_lower)
        if cache_key in TRANSLATION_CACHE:
            results[idx] = TRANSLATION_CACHE[cache_key]
        elif item in lang_dict:
            results[idx] = lang_dict[item]
            TRANSLATION_CACHE[cache_key] = lang_dict[item]
        else:
            uncached_indices.append(idx)
            uncached_texts.append(item)

    # Step B: Translate uncached items
    if uncached_texts:
        CHUNK_SIZE = 40
        for i in range(0, len(uncached_texts), CHUNK_SIZE):
            chunk_texts = uncached_texts[i:i + CHUNK_SIZE]
            chunk_indices = uncached_indices[i:i + CHUNK_SIZE]
            chunk_dict = {str(j): text for j, text in enumerate(chunk_texts)}

            # 1. Try RapidAPI Google Translate 113 JSON endpoint first
            rapid_res = await call_rapidapi_google_translate_json(chunk_dict, req.source, req.target)

            # 2. If missing items, fall back to Groq LLM batch
            missing_texts = []
            missing_orig_indices = []
            for j, (orig_idx, orig_text) in enumerate(zip(chunk_indices, chunk_texts)):
                trans_val = rapid_res.get(str(j))
                if trans_val and trans_val.strip() and trans_val.strip() != orig_text.strip():
                    results[orig_idx] = trans_val.strip()
                    TRANSLATION_CACHE[(orig_text, source_lower, target_lower)] = trans_val.strip()
                else:
                    missing_texts.append(orig_text)
                    missing_orig_indices.append(orig_idx)

            if missing_texts:
                groq_translated = translate_with_groq_batch(missing_texts, req.source, req.target)
                for orig_idx, orig_text, trans_text in zip(missing_orig_indices, missing_texts, groq_translated):
                    results[orig_idx] = trans_text
                    if trans_text and trans_text.strip() != orig_text.strip():
                        TRANSLATION_CACHE[(orig_text, source_lower, target_lower)] = trans_text

        save_disk_cache()

    return TranslateResponse(
        translated_text=results,
        source=req.source,
        target=req.target,
        provider="google_translate113_and_groq",
    )
