"""SQLite local database storage for uploaded documents and diagnostic reports.

Provides zero-disk-clutter persistence: reports and documents are stored as
structured records and binary BLOBs inside SQLite instead of littering the code repository.
"""

import json
import logging
import os
import sqlite3
import uuid
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default SQLite database path in database/ folder (shared between host and container)
DEFAULT_SQLITE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "database",
    "troubleshooter.db",
)
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", DEFAULT_SQLITE_PATH)


class SQLiteStorage:
    """Manages SQLite storage for documents, chunks, and diagnostic reports."""

    def __init__(self, db_path: str = SQLITE_DB_PATH) -> None:
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initialize database schema if tables do not exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Documents table (stores uploaded OEM manuals, diagrams, logs as BLOBs)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    filename TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    content_type TEXT,
                    file_data BLOB,
                    raw_text TEXT,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Reports table (stores generated PDF bytes and HTML strings inside database)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    report_id TEXT UNIQUE NOT NULL,
                    session_id TEXT,
                    title TEXT NOT NULL,
                    query TEXT NOT NULL,
                    machine_model TEXT,
                    error_code TEXT,
                    problem TEXT,
                    diagnosis TEXT,
                    probable_causes TEXT,
                    recommended_solutions TEXT,
                    safety_warnings TEXT,
                    confidence REAL,
                    confidence_level TEXT,
                    evidence TEXT,
                    pdf_data BLOB,
                    html_content TEXT,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_session ON documents(session_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_filename ON documents(filename);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_report_id ON reports(report_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);")
            conn.commit()

    # -------------------------------------------------------------------------
    # DOCUMENT OPERATIONS
    # -------------------------------------------------------------------------
    def save_document(
        self,
        filename: str,
        file_bytes: bytes,
        session_id: Optional[str] = None,
        content_type: Optional[str] = None,
        raw_text: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Persist an uploaded document in SQLite."""
        doc_id = str(uuid.uuid4())
        meta_json = json.dumps(metadata or {})
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Delete any existing document with the same filename in this session to prevent duplicate bloat
            cursor.execute(
                "DELETE FROM documents WHERE filename = ? AND (session_id = ? OR session_id IS NULL)",
                (filename, session_id),
            )
            cursor.execute(
                """
                INSERT INTO documents (id, session_id, filename, file_size, content_type, file_data, raw_text, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (doc_id, session_id, filename, len(file_bytes), content_type, file_bytes, raw_text, meta_json),
            )
            conn.commit()
            logger.info(f"Saved document {filename} ({len(file_bytes)} bytes) to SQLite [doc_id: {doc_id}]")
        return doc_id

    def list_documents(self, session_id: Optional[str] = None) -> list[dict[str, Any]]:
        """List documents without loading raw binary BLOBs."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if session_id:
                cursor.execute(
                    """
                    SELECT id, session_id, filename, file_size, content_type, created_at, metadata
                    FROM documents WHERE session_id = ? OR session_id IS NULL ORDER BY created_at DESC
                    """,
                    (session_id,),
                )
            else:
                cursor.execute(
                    """
                    SELECT id, session_id, filename, file_size, content_type, created_at, metadata
                    FROM documents ORDER BY created_at DESC
                    """
                )
            rows = cursor.fetchall()
            results = []
            for r in rows:
                meta = {}
                try:
                    if r["metadata"]:
                        meta = json.loads(r["metadata"])
                except Exception:
                    pass
                results.append({
                    "id": r["id"],
                    "session_id": r["session_id"],
                    "filename": r["filename"],
                    "file_size": r["file_size"],
                    "size_kb": round(r["file_size"] / 1024, 1),
                    "content_type": r["content_type"],
                    "created_at": r["created_at"],
                    "metadata": meta,
                })
            return results

    def get_document_bytes(self, filename: str, session_id: Optional[str] = None) -> Optional[bytes]:
        """Fetch raw binary file data from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if session_id:
                cursor.execute(
                    "SELECT file_data FROM documents WHERE filename = ? AND (session_id = ? OR session_id IS NULL) LIMIT 1",
                    (filename, session_id),
                )
            else:
                cursor.execute("SELECT file_data FROM documents WHERE filename = ? LIMIT 1", (filename,))
            row = cursor.fetchone()
            if row and row["file_data"]:
                return bytes(row["file_data"])
        return None

    def delete_document(self, filename: str, session_id: Optional[str] = None) -> bool:
        """Cancel and remove a document from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if session_id:
                cursor.execute(
                    "DELETE FROM documents WHERE filename = ? AND (session_id = ? OR session_id IS NULL)",
                    (filename, session_id),
                )
            else:
                cursor.execute("DELETE FROM documents WHERE filename = ?", (filename,))
            deleted = cursor.rowcount > 0
            conn.commit()
            if deleted:
                logger.info(f"Deleted document {filename} from SQLite")
            return deleted

    # -------------------------------------------------------------------------
    # REPORT OPERATIONS (STORES PDF AND HTML IN DATABASE, NOT REPO FOLDER)
    # -------------------------------------------------------------------------
    def save_report(
        self,
        report_data: dict[str, Any],
        pdf_bytes: Optional[bytes] = None,
        html_content: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> str:
        """Store generated report inside SQLite database (zero disk clutter)."""
        report_id = report_data.get("report_id") or str(uuid.uuid4())[:8].upper()
        uid = str(uuid.uuid4())
        title = f"Diagnostic Report - {report_data.get('machine_model', 'Equipment')} {report_data.get('error_code', '')}".strip()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Upsert into reports table
            cursor.execute(
                """
                INSERT INTO reports (
                    id, report_id, session_id, title, query, machine_model, error_code,
                    problem, diagnosis, probable_causes, recommended_solutions, safety_warnings,
                    confidence, confidence_level, evidence, pdf_data, html_content, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(report_id) DO UPDATE SET
                    query = excluded.query,
                    diagnosis = excluded.diagnosis,
                    probable_causes = excluded.probable_causes,
                    recommended_solutions = excluded.recommended_solutions,
                    safety_warnings = excluded.safety_warnings,
                    confidence = excluded.confidence,
                    confidence_level = excluded.confidence_level,
                    evidence = excluded.evidence,
                    pdf_data = excluded.pdf_data,
                    html_content = excluded.html_content,
                    metadata = excluded.metadata
                """,
                (
                    uid,
                    report_id,
                    session_id,
                    title,
                    report_data.get("query", ""),
                    report_data.get("machine_model", "Industrial Machine"),
                    report_data.get("error_code"),
                    report_data.get("problem", ""),
                    report_data.get("diagnosis", ""),
                    json.dumps(report_data.get("probable_causes", [])),
                    json.dumps(report_data.get("recommended_solutions", [])),
                    json.dumps(report_data.get("safety_warnings", [])),
                    float(report_data.get("confidence") or 0.9),
                    report_data.get("confidence_level", "HIGH"),
                    json.dumps(report_data.get("evidence_images", [])),
                    pdf_bytes,
                    html_content,
                    json.dumps({"report_id": report_id}),
                ),
            )
            conn.commit()
            logger.info(f"Report {report_id} successfully stored in SQLite database ({len(pdf_bytes or b'')} bytes PDF)")
        return report_id

    def get_report_meta(self, report_id: str) -> Optional[dict[str, Any]]:
        """Fetch report metadata from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, report_id, session_id, title, query, machine_model, error_code,
                       problem, diagnosis, probable_causes, recommended_solutions, safety_warnings,
                       confidence, confidence_level, (pdf_data IS NOT NULL) as has_pdf,
                       (html_content IS NOT NULL) as has_html, created_at
                FROM reports WHERE report_id = ? LIMIT 1
                """,
                (report_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            return {
                "report_id": row["report_id"],
                "session_id": row["session_id"],
                "title": row["title"],
                "query": row["query"],
                "machine_model": row["machine_model"],
                "error_code": row["error_code"],
                "problem": row["problem"],
                "diagnosis": row["diagnosis"],
                "probable_causes": json.loads(row["probable_causes"] or "[]"),
                "recommended_solutions": json.loads(row["recommended_solutions"] or "[]"),
                "safety_warnings": json.loads(row["safety_warnings"] or "[]"),
                "confidence": row["confidence"],
                "confidence_level": row["confidence_level"],
                "has_pdf": bool(row["has_pdf"]),
                "has_html": bool(row["has_html"]),
                "pdf_url": f"/api/reports/{row['report_id']}/pdf",
                "html_url": f"/api/reports/{row['report_id']}/html",
                "created_at": row["created_at"],
            }

    def get_report_pdf(self, report_id: str) -> Optional[bytes]:
        """Fetch binary PDF bytes directly from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT pdf_data FROM reports WHERE report_id = ? LIMIT 1", (report_id,))
            row = cursor.fetchone()
            if row and row["pdf_data"]:
                return bytes(row["pdf_data"])
        return None

    def get_report_html(self, report_id: str) -> Optional[str]:
        """Fetch HTML content string directly from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT html_content FROM reports WHERE report_id = ? LIMIT 1", (report_id,))
            row = cursor.fetchone()
            if row and row["html_content"]:
                return str(row["html_content"])
        return None

    def list_reports(self, limit: int = 50) -> list[dict[str, Any]]:
        """List recently generated reports from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT report_id, session_id, title, query, machine_model, error_code,
                       confidence_level, (pdf_data IS NOT NULL) as has_pdf,
                       (html_content IS NOT NULL) as has_html, created_at
                FROM reports ORDER BY created_at DESC LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            return [
                {
                    "report_id": row["report_id"],
                    "session_id": row["session_id"],
                    "title": row["title"],
                    "query": row["query"],
                    "machine_model": row["machine_model"],
                    "error_code": row["error_code"],
                    "confidence_level": row["confidence_level"],
                    "has_pdf": bool(row["has_pdf"]),
                    "has_html": bool(row["has_html"]),
                    "pdf_url": f"/api/reports/{row['report_id']}/pdf",
                    "html_url": f"/api/reports/{row['report_id']}/html",
                    "created_at": row["created_at"],
                }
                for row in rows
            ]


# Global singleton instance
_sqlite_storage: Optional[SQLiteStorage] = None


def get_sqlite_storage() -> SQLiteStorage:
    global _sqlite_storage
    if _sqlite_storage is None:
        _sqlite_storage = SQLiteStorage()
    return _sqlite_storage
