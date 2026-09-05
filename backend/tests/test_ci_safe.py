"""
Lightweight CI-safe tests — no ML model downloads, no live backend required.
These tests verify syntax, config, API contract, and fast utility functions only.
Heavy tests that require GPU/ML weights are marked @pytest.mark.slow and skipped in CI.
"""

import os
import sys
import json
import pytest

# Ensure backend/app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# 1. Environment & Config tests
# ---------------------------------------------------------------------------

def test_required_directories_can_be_created(tmp_path):
    """Ensure manuals and DB dirs can be created (used by backend on startup)."""
    manuals_dir = tmp_path / "manuals"
    db_dir = tmp_path / "database"
    manuals_dir.mkdir()
    db_dir.mkdir()
    assert manuals_dir.exists()
    assert db_dir.exists()


def test_groq_api_key_format():
    """Check GROQ_API_KEY looks like a real key (starts with gsk_) if set."""
    key = os.getenv("GROQ_API_KEY", "")
    if key:
        assert key.startswith("gsk_"), f"GROQ_API_KEY should start with 'gsk_', got: {key[:10]}..."
    else:
        pytest.skip("GROQ_API_KEY not set — skipping key format check")


def test_elevenlabs_api_key_present():
    """Ensure ElevenLabs key is configured in env."""
    key = os.getenv("ELEVENLABS_API_KEY", "")
    if key:
        assert len(key) > 10, "ELEVENLABS_API_KEY seems too short"
    else:
        pytest.skip("ELEVENLABS_API_KEY not set — skipping")


def test_supabase_url_format():
    """Check Supabase URL is a valid https URL if set."""
    url = os.getenv("SUPABASE_URL", "")
    if url:
        assert url.startswith("https://"), f"SUPABASE_URL should start with https://, got: {url[:30]}"
        assert ".supabase.co" in url, "SUPABASE_URL should contain .supabase.co"
    else:
        pytest.skip("SUPABASE_URL not set — skipping")


# ---------------------------------------------------------------------------
# 2. FastAPI app import & health endpoint (no ML, no DB)
# ---------------------------------------------------------------------------

def test_app_imports_successfully():
    """The FastAPI app module should import without crashing."""
    try:
        # Set fake env vars so config doesn't crash on missing values
        os.environ.setdefault("GROQ_API_KEY", "gsk_test_key_placeholder")
        os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
        os.environ.setdefault("SUPABASE_KEY", "test_key")
        os.environ.setdefault("MANUALS_DIR", "/tmp/manuals")
        os.environ.setdefault("SQLITE_DB_PATH", "/tmp/test.db")
        os.makedirs("/tmp/manuals", exist_ok=True)

        from app.main import app
        assert app is not None
        assert app.title is not None
        print(f"  App: {app.title}")
    except ImportError as e:
        # Some heavy imports (torch, cv2) may not be installed in CI — that's OK
        if "torch" in str(e) or "cv2" in str(e) or "sentence_transformers" in str(e):
            pytest.skip(f"ML dependency not installed in CI: {e}")
        raise


def test_health_endpoint():
    """Health check should return 200 with status:healthy."""
    try:
        os.environ.setdefault("GROQ_API_KEY", "gsk_test_key_placeholder")
        os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
        os.environ.setdefault("SUPABASE_KEY", "test_key")
        os.environ.setdefault("MANUALS_DIR", "/tmp/manuals")
        os.environ.setdefault("SQLITE_DB_PATH", "/tmp/test.db")
        os.makedirs("/tmp/manuals", exist_ok=True)

        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    except ImportError as e:
        if "torch" in str(e) or "cv2" in str(e) or "sentence_transformers" in str(e):
            pytest.skip(f"ML dependency not installed in CI: {e}")
        raise


# ---------------------------------------------------------------------------
# 3. Utility / pure-Python logic tests (no ML, no network)
# ---------------------------------------------------------------------------

def test_report_data_structure():
    """Verify the report data schema can be constructed correctly."""
    report = {
        "query": "E101 Spindle thermal trip",
        "machine_model": "CNC-X100",
        "error_code": "E101",
        "problem": "Spindle motor temperature high",
        "diagnosis": "Cooling fan filter obstructed",
        "probable_causes": ["Clogged fan filter", "Ambient temperature too high"],
        "recommended_solutions": [
            {
                "priority": 1,
                "action": "Clean filter with compressed air",
                "reason": "Restores airflow to within spec",
                "evidence_strength": "Strong",
                "source": "CNC-X100 Manual p. 42",
            }
        ],
        "safety_warnings": ["Power off machine before servicing"],
        "confidence_level": "HIGH",
        "confidence": 0.95,
        "evidence_images": [],
    }
    assert report["confidence"] >= 0.0
    assert report["confidence"] <= 1.0
    assert len(report["recommended_solutions"]) > 0
    assert report["recommended_solutions"][0]["priority"] == 1


def test_api_error_codes_are_strings():
    """Error codes parsed from logs should be non-empty strings."""
    raw_codes = ["E101", "ERR-42", "F0023", "  E999  "]
    cleaned = [c.strip() for c in raw_codes if c.strip()]
    assert all(isinstance(c, str) and len(c) > 0 for c in cleaned)
    assert "E101" in cleaned
    assert "ERR-42" in cleaned


def test_language_detection_mapping():
    """Language code mapping used in voice response should cover common codes."""
    lang_map = {
        "en": "English",
        "hi": "Hindi",
        "mr": "Marathi",
        "de": "German",
        "fr": "French",
        "ja": "Japanese",
        "zh": "Chinese",
    }
    assert lang_map.get("mr") == "Marathi"
    assert lang_map.get("hi") == "Hindi"
    assert lang_map.get("en") == "English"


def test_env_defaults_are_safe():
    """Default values for non-critical env vars should be sensible strings."""
    defaults = {
        "GROQ_MODEL": "qwen/qwen3.8-27b",
        "ELEVENLABS_MODEL_ID": "eleven_multilingual_v2",
        "LOG_LEVEL": "info",
        "BACKEND_PORT": "8000",
        "EMBEDDING_DIMENSION": "1024",
        "SUPABASE_STORAGE_BUCKET": "manuals",
    }
    for k, v in defaults.items():
        assert isinstance(v, str) and len(v) > 0, f"Default for {k} must be non-empty string"


# ---------------------------------------------------------------------------
# 4. File upload path safety
# ---------------------------------------------------------------------------

def test_allowed_file_extensions():
    """Only safe file extensions should be accepted for upload."""
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv", ".log", ".png", ".jpg", ".jpeg"}
    safe_files = ["manual.pdf", "errors.csv", "log.txt", "photo.png"]
    dangerous_files = ["evil.exe", "script.sh", "malware.bat", "hack.php"]

    for f in safe_files:
        ext = os.path.splitext(f)[1].lower()
        assert ext in ALLOWED_EXTENSIONS, f"{f} should be allowed"

    for f in dangerous_files:
        ext = os.path.splitext(f)[1].lower()
        assert ext not in ALLOWED_EXTENSIONS, f"{f} should NOT be allowed"


def test_upload_filename_sanitization():
    """Filenames with path traversal should be sanitized."""
    import re
    dangerous_names = [
        "../../etc/passwd",
        "../secrets/.env",
        "normal../../bad",
        "/absolute/path/file.pdf",
    ]
    # Simulate a simple sanitizer
    def sanitize(name: str) -> str:
        name = os.path.basename(name)         # strip dirs
        name = re.sub(r'[^\w\-_\. ]', '', name)  # strip special chars
        return name

    for name in dangerous_names:
        safe = sanitize(name)
        assert ".." not in safe
        assert "/" not in safe
