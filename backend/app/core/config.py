"""Centralized application configuration from environment variables."""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All configuration is loaded from environment variables."""

    # --- Groq LLM Configuration (Primary) ---
    GROQ_API_KEY: str = "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"
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_FAST_MODEL: str = "openai/gpt-oss-20b"
    GROQ_REASONING_MODEL: str = "openai/gpt-oss-120b"
    GROQ_VISION_MODEL: str = "openai/gpt-oss-20b"

    # --- RapidAPI Google Translate 113 Configuration ---
    RAPIDAPI_TRANSLATE_KEY: str = "0c41dd989fmsh8331390bf41a4cfp14a23ajsn42c4974f6cb0"
    RAPIDAPI_TRANSLATE_HOST: str = "google-translate113.p.rapidapi.com"
    RAPIDAPI_TRANSLATE_URL: str = "https://google-translate113.p.rapidapi.com/api/v1/translator"

    # --- Serper Web Search ---
    SERPER_API_KEY: str = ""

    # --- ElevenLabs Voice Configuration ---
    ELEVENLABS_API_KEY: str = "sk_fba5cf151cea3db4dfb248622cd85872fd097a02fa15520e"
    ELEVENLABS_VOICE_ID: str = "gHu9GtaHOXcSqFTK06ux"
    ELEVENLABS_FALLBACK_VOICE_ID: str = "EXAVITQu4vr4xnSDxMaL"
    ELEVENLABS_MODEL_ID: str = "eleven_multilingual_v2"

    # --- OpenAI Configuration ---
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.5"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_PROVIDER: str = "local"  # "local" (BAAI/bge-m3) or "openai"

    # --- Azure OpenAI (Fallback/Direct compatibility) ---
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_KEY: str = ""
    AZURE_OPENAI_VERSION: str = "2025-01-01-preview"
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-5.5"
    MODEL_GEN: str = "gpt-5.5"

    # --- Supabase ---
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    DATABASE_URL: str = ""
    SUPABASE_STORAGE_BUCKET: str = "manuals"

    # --- Embedding & Reranker Models ---
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSION: int = 1024
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"

    # --- Server ---
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    LOG_LEVEL: str = "info"

    # --- Paths ---
    HF_HOME: str = "/app/model_cache"
    MANUALS_DIR: str = "/app/manuals"
    EVIDENCE_DIR: str = "/app/manuals/evidence"
    REPORTS_DIR: str = "/app/manuals/reports"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()

# Ensure required local storage directories exist
os.makedirs(settings.MANUALS_DIR, exist_ok=True)
os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
os.makedirs(settings.REPORTS_DIR, exist_ok=True)
