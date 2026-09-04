"""Supabase client and database connection management."""

import logging
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache()
def get_supabase_client() -> Client:
    """Get a cached Supabase client instance.

    Uses the service-role key or secret key for backend access.
    This key must NEVER be exposed to the frontend.
    """
    key = (
        settings.SUPABASE_SERVICE_ROLE_KEY
        or settings.SUPABASE_SECRET_KEY
        or settings.SUPABASE_KEY
    )
    if not settings.SUPABASE_URL or not key:
        logger.warning(
            "Supabase credentials not configured. "
            "Database operations will fail."
        )
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY must be set."
        )

    client = create_client(
        settings.SUPABASE_URL,
        key,
    )
    logger.info("Supabase client initialized")
    return client


def get_storage_bucket():
    """Get the Supabase Storage bucket for manual uploads."""
    client = get_supabase_client()
    return client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
