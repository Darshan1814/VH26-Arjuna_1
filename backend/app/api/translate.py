"""Translation API route using Deep Translate RapidAPI with caching and fallback."""

import logging
from typing import Dict, List, Union
import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

RAPIDAPI_URL = "https://deep-translate1.p.rapidapi.com/language/translate/v2"
RAPIDAPI_HOST = "deep-translate1.p.rapidapi.com"
RAPIDAPI_KEY = "0c41dd989fmsh8331390bf41a4cfp14a23ajsn42c4974f6cb0"

# In-memory translation cache to save quota and speed up repeated requests
# Key: (text, source_lang, target_lang) -> Value: translated_text
TRANSLATION_CACHE: Dict[tuple, str] = {}

# Built-in translations for UI strings as a resilient fallback
FALLBACK_DICTIONARY: Dict[str, Dict[str, str]] = {
    # Spanish (es)
    "es": {
        "Machine Troubleshooter": "Solucionador de Problemas de Máquinas",
        "Chatbot": "Chatbot",
        "Process Flow": "Flujo del Proceso",
        "Troubleshooting Assistant": "Asistente de Solución de Problemas",
        "Ask about error codes, machine issues, or troubleshooting steps": "Pregunte sobre códigos de error, problemas de la máquina o pasos de diagnóstico",
        "Clear conversation": "Limpiar conversación",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "Obtenga ayuda diagnóstica de los manuales de servicio. Pregunte sobre códigos de error, síntomas o procedimientos.",
        "What does error E101 mean?": "¿Qué significa el error E101?",
        "Why is my CNC-X100 overheating?": "¿Por qué se sobrecalienta mi CNC-X100?",
        "What does E101 mean on PRESS-Z200?": "¿Qué significa E101 en PRESS-Z200?",
        "Type your question...": "Escriba su pregunta...",
        "Send": "Enviar",
        "All Services Are Up and Running!": "¡Todos los servicios están en funcionamiento!",
        "PDF Manuals": "Manuales en PDF",
        "Document Processing": "Procesamiento de Documentos",
        "OCR / Layout Extraction": "OCR / Extracción de Diseño",
        "Chunking": "División en Fragmentos",
        "Embeddings (BGE-M3)": "Incrustaciones (BGE-M3)",
        "Hybrid Retrieval": "Recuperación Híbrida",
        "Reranking": "Reclasificación",
        "Evidence Verification": "Verificación de Evidencia",
        "Response Generation": "Generación de Respuestas",
        "Citations & Highlights": "Citas y Destacados",
        "Language": "Idioma",
        "Select Language": "Seleccionar Idioma",
        "English": "Inglés",
        "Spanish": "Español",
        "French": "Francés",
        "German": "Alemán",
        "Hindi": "Hindi",
        "Japanese": "Japonés",
        "Chinese": "Chino",
        "Arabic": "Árabe",
        "Marathi": "Maratí",
    },
    # French (fr)
    "fr": {
        "Machine Troubleshooter": "Dépannage de Machines",
        "Chatbot": "Chatbot",
        "Process Flow": "Flux de Processus",
        "Troubleshooting Assistant": "Assistant de Dépannage",
        "Ask about error codes, machine issues, or troubleshooting steps": "Posez des questions sur les codes d'erreur ou les pannes",
        "Clear conversation": "Effacer la conversation",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "Obtenez une aide diagnostique à partir des manuels de service.",
        "What does error E101 mean?": "Que signifie l'erreur E101 ?",
        "Why is my CNC-X100 overheating?": "Pourquoi ma CNC-X100 surchauffe-t-elle ?",
        "What does E101 mean on PRESS-Z200?": "Que signifie E101 sur PRESS-Z200 ?",
        "Type your question...": "Tapez votre question...",
        "Send": "Envoyer",
        "PDF Manuals": "Manuels PDF",
        "Document Processing": "Traitement de Documents",
        "OCR / Layout Extraction": "OCR / Extraction de Mise en Page",
        "Chunking": "Découpage",
        "Embeddings (BGE-M3)": "Plongements (BGE-M3)",
        "Language": "Langue",
    },
    # German (de)
    "de": {
        "Machine Troubleshooter": "Maschinen-Fehlerbehebung",
        "Chatbot": "Chatbot",
        "Process Flow": "Prozessablauf",
        "Troubleshooting Assistant": "Fehlerbehebungs-Assistent",
        "Ask about error codes, machine issues, or troubleshooting steps": "Fragen Sie nach Fehlercodes, Maschinenproblemen oder Diagnoseschritten",
        "Clear conversation": "Unterhaltung löschen",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "Erhalten Sie Diagnosehilfe aus Servicehandbüchern.",
        "What does error E101 mean?": "Was bedeutet Fehler E101?",
        "Why is my CNC-X100 overheating?": "Warum überhitzt meine CNC-X100?",
        "What does E101 mean on PRESS-Z200?": "Was bedeutet E101 auf PRESS-Z200?",
        "Type your question...": "Geben Sie Ihre Frage ein...",
        "Send": "Senden",
        "PDF Manuals": "PDF-Handbücher",
        "Document Processing": "Dokumentenverarbeitung",
        "Language": "Sprache",
    },
    # Hindi (hi)
    "hi": {
        "Machine Troubleshooter": "मशीन समस्या निवारक",
        "Chatbot": "चैटबॉट",
        "Process Flow": "प्रक्रिया प्रवाह",
        "Troubleshooting Assistant": "समस्या निवारण सहायक",
        "Ask about error codes, machine issues, or troubleshooting steps": "त्रुटि कोड, मशीन की समस्याओं या समाधान चरणों के बारे में पूछें",
        "Clear conversation": "बातचीत साफ़ करें",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "सर्विस मैनुअल से नैदानिक सहायता प्राप्त करें। त्रुटि कोड और लक्षणों के बारे में पूछें।",
        "What does error E101 mean?": "त्रुटि E101 का क्या अर्थ है?",
        "Why is my CNC-X100 overheating?": "मेरा CNC-X100 अधिक गर्म क्यों हो रहा है?",
        "What does E101 mean on PRESS-Z200?": "PRESS-Z200 पर E101 का क्या अर्थ है?",
        "Type your question...": "अपना प्रश्न टाइप करें...",
        "Send": "भेजें",
        "PDF Manuals": "पीडीएफ मैनुअल",
        "Document Processing": "दस्तावेज़ प्रसंस्करण",
        "OCR / Layout Extraction": "ओसीआर / लेआउट निष्कर्षण",
        "Chunking": "चंकिंग",
        "Embeddings (BGE-M3)": "एम्बेडिंग (BGE-M3)",
        "Language": "भाषा",
    },
    # Marathi (mr)
    "mr": {
        "Machine Troubleshooter": "मशिन समस्या निवारक",
        "Chatbot": "चॅटबॉट",
        "Process Flow": "प्रक्रिया प्रवाह",
        "Troubleshooting Assistant": "समस्या निवारण सहाय्यक",
        "Ask about error codes, machine issues, or troubleshooting steps": "त्रुटी कोड किंवा मशिनच्या समस्यांबद्दल विचारा",
        "Clear conversation": "संभाषण साफ करा",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "सर्व्हिस मॅन्युअलमधून मार्गदर्शन मिळवा.",
        "What does error E101 mean?": "त्रुटी E101 चा अर्थ काय आहे?",
        "Why is my CNC-X100 overheating?": "माझे CNC-X100 का तापत आहे?",
        "What does E101 mean on PRESS-Z200?": "PRESS-Z200 वर E101 चा काय अर्थ आहे?",
        "Type your question...": "तुमचा प्रश्न टाईप करा...",
        "Send": "पाठवा",
        "Language": "भाषा",
    },
    # Japanese (ja)
    "ja": {
        "Machine Troubleshooter": "機械トラブルシューター",
        "Chatbot": "チャットボット",
        "Process Flow": "プロセスフロー",
        "Troubleshooting Assistant": "トラブルシューティングアシスタント",
        "Ask about error codes, machine issues, or troubleshooting steps": "エラーコード、機械の問題、または手順について質問してください",
        "Clear conversation": "会話をクリア",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "サービスマニュアルから診断サポートを受けられます。",
        "What does error E101 mean?": "エラーE101は何を意味しますか？",
        "Why is my CNC-X100 overheating?": "CNC-X100が過熱するのはなぜですか？",
        "What does E101 mean on PRESS-Z200?": "PRESS-Z200のE101はどういう意味ですか？",
        "Type your question...": "質問を入力...",
        "Send": "送信",
        "Language": "言語",
    },
    # Chinese (zh)
    "zh": {
        "Machine Troubleshooter": "机器故障诊断仪",
        "Chatbot": "聊天机器人",
        "Process Flow": "处理流程",
        "Troubleshooting Assistant": "故障排除助手",
        "Ask about error codes, machine issues, or troubleshooting steps": "咨询错误代码、机器问题或排除步骤",
        "Clear conversation": "清除对话",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "从维修手册中获取诊断帮助。",
        "What does error E101 mean?": "错误 E101 是什么意思？",
        "Why is my CNC-X100 overheating?": "为什么我的 CNC-X100 过热？",
        "What does E101 mean on PRESS-Z200?": "PRESS-Z200 上的 E101 是什么意思？",
        "Type your question...": "输入您的问题...",
        "Send": "发送",
        "Language": "语言",
    },
    # Arabic (ar)
    "ar": {
        "Machine Troubleshooter": "مستكشف أخطاء الماكينة ومصلحها",
        "Chatbot": "روبوت الدردشة",
        "Process Flow": "تدفق العمليات",
        "Troubleshooting Assistant": "مساعد استكشاف الأخطاء",
        "Ask about error codes, machine issues, or troubleshooting steps": "اسأل عن رموز الأخطاء أو مشاكل الآلة",
        "Clear conversation": "مسح المحادثة",
        "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.": "احصل على مساعدة تشخيصية من أدلة الخدمة.",
        "What does error E101 mean?": "ماذا يعني الخطأ E101؟",
        "Why is my CNC-X100 overheating?": "لماذا ترتفع درجة حرارة CNC-X100؟",
        "What does E101 mean on PRESS-Z200?": "ماذا يعني E101 في PRESS-Z200؟",
        "Type your question...": "اكتب سؤالك...",
        "Send": "إرسال",
        "Language": "اللغة",
    },
}


import json
import os
from app.core.config import settings

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

CACHE_FILE = os.path.join(settings.MANUALS_DIR, "translations_cache.json")

def load_disk_cache():
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
    source: str = Field(default="en", description="Source language code (e.g. 'en')")
    target: str = Field(..., description="Target language code (e.g. 'es', 'fr', 'hi')")


class TranslateResponse(BaseModel):
    translated_text: Union[str, List[str]]
    source: str
    target: str
    provider: str


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
        res = client.json_completion([{"role": "user", "content": prompt}])
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


async def call_deep_translate_api(text: str, source: str, target: str) -> str:
    """Call Deep Translate RapidAPI, with automatic Groq LLM fallback."""
    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": RAPIDAPI_KEY,
    }
    payload = {"q": text, "source": source, "target": target}

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(RAPIDAPI_URL, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                translated = (
                    data.get("data", {})
                    .get("translations", {})
                    .get("translatedText")
                )
                if translated:
                    return str(translated)
    except Exception:
        pass

    # Fallback to local dictionary
    lang_dict = FALLBACK_DICTIONARY.get(target.lower(), {})
    if text in lang_dict:
        return lang_dict[text]

    # Seamless high-accuracy Groq fallback
    groq_res = translate_with_groq_batch([text], source, target)
    return groq_res[0] if groq_res else text


@router.post("", response_model=TranslateResponse)
async def translate_text(req: TranslateRequest):
    """Translate one or multiple texts into target language."""
    if req.target.lower() == req.source.lower():
        return TranslateResponse(
            translated_text=req.q,
            source=req.source,
            target=req.target,
            provider="identity",
        )

    # Single string translation
    if isinstance(req.q, str):
        cache_key = (req.q, req.source.lower(), req.target.lower())
        if cache_key in TRANSLATION_CACHE:
            return TranslateResponse(
                translated_text=TRANSLATION_CACHE[cache_key],
                source=req.source,
                target=req.target,
                provider="cache",
            )

        translated = await call_deep_translate_api(req.q, req.source, req.target)
        if translated and translated.strip() != req.q.strip():
            TRANSLATION_CACHE[cache_key] = translated
            save_disk_cache()
        return TranslateResponse(
            translated_text=translated,
            source=req.source,
            target=req.target,
            provider="groq_or_api",
        )

    # Batch translation
    source_lower = req.source.lower()
    target_lower = req.target.lower()
    results: List[str] = [""] * len(req.q)
    uncached_indices: List[int] = []
    uncached_texts: List[str] = []

    # 1. Fill from cache and local dictionary
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

    # 2. Batch-translate uncached items via Groq in chunks of 35
    if uncached_texts:
        CHUNK_SIZE = 35
        for i in range(0, len(uncached_texts), CHUNK_SIZE):
            chunk_texts = uncached_texts[i:i + CHUNK_SIZE]
            chunk_indices = uncached_indices[i:i + CHUNK_SIZE]
            translated_chunk = translate_with_groq_batch(chunk_texts, req.source, req.target)
            for orig_idx, orig_text, trans_text in zip(chunk_indices, chunk_texts, translated_chunk):
                results[orig_idx] = trans_text
                # Only cache if actually translated to avoid poisoning cache with raw English
                if trans_text and trans_text.strip() != orig_text.strip():
                    TRANSLATION_CACHE[(orig_text, source_lower, target_lower)] = trans_text

        save_disk_cache()

    return TranslateResponse(
        translated_text=results,
        source=req.source,
        target=req.target,
        provider="groq_batch",
    )
