"""Centralized application configuration from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All configuration is loaded from environment variables."""

    # --- Generation Model ---
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_KEY: str = ""
    AZURE_OPENAI_VERSION: str = "2025-01-01-preview"
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-5-mini"
    MODEL_GEN: str = "gpt-5.4"

    # --- Supabase ---
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    DATABASE_URL: str = ""
    SUPABASE_STORAGE_BUCKET: str = "manuals"

    # --- Embedding ---
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSION: int = 1024

    # --- Reranker ---
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"

    # --- Server ---
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    LOG_LEVEL: str = "info"
    CORS_ORIGINS: str = "*"

    # --- Model Cache ---
    HF_HOME: str = "/app/model_cache"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


settings = Settings()
