"""SQLite local database storage for uploaded documents and diagnostic reports.

Provides zero-disk-clutter persistence: reports and documents are stored as
structured records and binary BLOBs inside SQLite instead of littering the code repository.
"""

import json
import logging
import os
import sqlite3
import struct
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
        """Initialize database schema if tables do not exist and apply migrations."""
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

            # Chunks table (stores text chunks, PS metadata, and 1024-dim dense vector embeddings)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT,
                    session_id TEXT,
                    filename TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    machine TEXT,
                    model TEXT,
                    machine_model TEXT,
                    error_code TEXT,
                    error_codes TEXT,
                    section TEXT,
                    page_number INTEGER,
                    symptom TEXT,
                    probable_cause TEXT,
                    corrective_action TEXT,
                    content TEXT NOT NULL,
                    vector_dim INTEGER DEFAULT 1024,
                    embedding_stored INTEGER DEFAULT 0,
                    embedding BLOB,
                    embedding_json TEXT,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Apply any column migrations for existing databases
            self._migrate_columns(cursor)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_session ON documents(session_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_filename ON documents(filename);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_report_id ON reports(report_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunks(session_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_machine ON chunks(machine);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_model ON chunks(model);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_mach_model ON chunks(machine_model);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_error_code ON chunks(error_code);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_number);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(filename);")
            conn.commit()

    def _migrate_columns(self, cursor: sqlite3.Cursor) -> None:
        """Dynamically add any missing PS columns to chunks table if it was created previously."""
        try:
            cursor.execute("PRAGMA table_info(chunks);")
            existing_cols = {row["name"] for row in cursor.fetchall()}
            needed_columns = {
                "machine": "TEXT",
                "model": "TEXT",
                "error_code": "TEXT",
                "symptom": "TEXT",
                "probable_cause": "TEXT",
                "corrective_action": "TEXT",
                "vector_dim": "INTEGER DEFAULT 1024",
                "embedding_stored": "INTEGER DEFAULT 0",
            }
            for col_name, col_type in needed_columns.items():
                if col_name not in existing_cols:
                    cursor.execute(f"ALTER TABLE chunks ADD COLUMN {col_name} {col_type};")
                    logger.info(f"Added column '{col_name}' ({col_type}) to SQLite chunks table.")
        except Exception as e:
            logger.warning(f"Column migration check returned: {e}")

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

    # -------------------------------------------------------------------------
    # CHUNK & VECTOR OPERATIONS
    # -------------------------------------------------------------------------
    def save_chunks(self, chunks: list[dict[str, Any]], session_id: Optional[str] = None) -> int:
        """Persist document chunks with vector embeddings and PS metadata into SQLite."""
        if not chunks:
            return 0

        saved = 0
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for c in chunks:
                cid = c.get("id") or str(uuid.uuid4())[:8]
                doc_id = c.get("document_id") or c.get("manual_id")
                fname = c.get("file_name") or c.get("filename") or "manual.pdf"
                cidx = c.get("chunk_index", 0)
                sec = c.get("section", "General")
                page = c.get("page_number") or c.get("page", 1)

                # Machine & Model parsing
                mach_mod = c.get("machine_model") or ""
                mach = c.get("machine")
                mod = c.get("model")
                if not mach and mach_mod:
                    mach = mach_mod.split()[0] if mach_mod else "Machine"
                if not mod and mach_mod:
                    parts = mach_mod.split()
                    mod = parts[-1] if len(parts) > 1 else mach_mod

                # Error codes
                err_list = c.get("error_codes", [])
                if isinstance(err_list, str):
                    try:
                        err_list = json.loads(err_list)
                    except Exception:
                        err_list = [err_list]
                err_code = c.get("error_code") or (err_list[0] if err_list else None)
                errs_json = json.dumps(err_list)

                # Diagnostic metadata
                symptom = c.get("symptom") or (c.get("metadata", {}).get("symptom") if isinstance(c.get("metadata"), dict) else None)
                prob_cause = c.get("probable_cause") or (c.get("metadata", {}).get("probable_cause") if isinstance(c.get("metadata"), dict) else None)
                corr_action = c.get("corrective_action") or (c.get("metadata", {}).get("corrective_action") if isinstance(c.get("metadata"), dict) else None)

                content = c.get("content", "")

                # Embedding vector & BLOB serialization
                vec = c.get("embedding")
                vec_dim = len(vec) if vec else 1024
                emb_stored = 1 if vec else 0
                vec_json = json.dumps(vec) if vec else None
                vec_blob = None
                if vec and isinstance(vec, list):
                    try:
                        vec_blob = struct.pack(f"{len(vec)}f", *vec)
                    except Exception:
                        vec_blob = None

                meta_json = json.dumps(c.get("metadata", {}))

                cursor.execute(
                    """
                    INSERT OR REPLACE INTO chunks (
                        id, document_id, session_id, filename, chunk_index,
                        machine, model, machine_model, error_code, error_codes,
                        section, page_number, symptom, probable_cause, corrective_action,
                        content, vector_dim, embedding_stored, embedding, embedding_json, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        cid, doc_id, session_id, fname, cidx,
                        mach, mod, mach_mod, err_code, errs_json,
                        sec, page, symptom, prob_cause, corr_action,
                        content, vec_dim, emb_stored, vec_blob, vec_json, meta_json,
                    ),
                )
                saved += 1
            conn.commit()
            logger.info(f"Successfully stored {saved} chunks with vector embeddings into SQLite database")
        return saved

    def search_chunks(
        self,
        query_text: Optional[str] = None,
        machine_model: Optional[str] = None,
        error_code: Optional[str] = None,
        query_vector: Optional[list[float]] = None,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """Search chunks in SQLite using exact error match, keyword match, and cosine similarity."""
        results = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM chunks WHERE 1=1"
            params: list[Any] = []

            if machine_model:
                query += " AND (machine_model LIKE ? OR machine LIKE ? OR model LIKE ? OR machine_model IS NULL)"
                params.extend([f"%{machine_model}%", f"%{machine_model}%", f"%{machine_model}%"])

            cursor.execute(query, params)
            rows = cursor.fetchall()

            for row in rows:
                c_dict = dict(row)
                score = 0.0
                match_type = "hybrid"

                # 1. Exact Error Code Match
                if error_code:
                    stored_code = (c_dict.get("error_code") or "").upper()
                    stored_codes = (c_dict.get("error_codes") or "").upper()
                    if error_code.upper() in stored_code or error_code.upper() in stored_codes:
                        score += 0.95
                        match_type = "exact_error"

                # 2. Keyword lexical overlap
                if query_text:
                    content_lower = c_dict["content"].lower()
                    terms = [t for t in query_text.lower().split() if len(t) > 2]
                    kw_score = sum(1 for t in terms if t in content_lower) / max(len(terms), 1)
                    score += kw_score * 0.40

                # 3. Vector Cosine Similarity
                if query_vector and c_dict.get("embedding_json"):
                    try:
                        emb = json.loads(c_dict["embedding_json"])
                        dot = sum(a * b for a, b in zip(query_vector, emb))
                        norm_q = sum(a * a for a in query_vector) ** 0.5
                        norm_e = sum(b * b for b in emb) ** 0.5
                        if norm_q > 0 and norm_e > 0:
                            cos_sim = dot / (norm_q * norm_e)
                            score = max(score, float(cos_sim))
                            match_type = "vector" if match_type != "exact_error" else match_type
                    except Exception:
                        pass

                c_dict["similarity_score"] = min(round(score, 4), 1.0)
                c_dict["match_type"] = match_type
                if score > 0.05 or error_code:
                    results.append(c_dict)

            results.sort(
                key=lambda x: (
                    0 if x["match_type"] == "exact_error" else 1,
                    -x["similarity_score"],
                )
            )
            return results[:top_k]

    def clear_all_documents(self, clear_reports: bool = False) -> dict[str, int]:
        """Completely wipe all uploaded documents, chunks, and optionally reports."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM documents;")
            doc_count = cursor.rowcount
            cursor.execute("DELETE FROM chunks;")
            chunk_count = cursor.rowcount
            report_count = 0
            if clear_reports:
                cursor.execute("DELETE FROM reports;")
                report_count = cursor.rowcount
            conn.commit()
            logger.info(f"Cleared all documents ({doc_count}), chunks ({chunk_count}), reports ({report_count}) from SQLite")
            return {"deleted_documents": doc_count, "deleted_chunks": chunk_count, "deleted_reports": report_count}

    def inspect_stored_vectors(self, limit: int = 5) -> dict[str, Any]:
        """Detailed database inspection showing all new columns, vector storage status, and sample rows."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM chunks")
            total_chunks = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM chunks WHERE embedding_stored = 1 OR embedding_json IS NOT NULL")
            vector_chunks = cursor.fetchone()[0]

            cursor.execute("SELECT DISTINCT machine FROM chunks WHERE machine IS NOT NULL")
            machines = [r[0] for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT error_code FROM chunks WHERE error_code IS NOT NULL")
            error_codes = [r[0] for r in cursor.fetchall()]

            cursor.execute("""
                SELECT id, filename, machine, model, machine_model, error_code,
                       section, page_number, vector_dim, embedding_stored,
                       LENGTH(embedding) as blob_bytes,
                       SUBSTR(content, 1, 120) as content_preview
                FROM chunks
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
            sample_rows = [dict(r) for r in cursor.fetchall()]

            return {
                "database": "SQLite (database/troubleshooter.db)",
                "table": "chunks",
                "columns": [
                    "id", "document_id", "session_id", "filename", "chunk_index",
                    "machine", "model", "machine_model", "error_code", "error_codes",
                    "section", "page_number", "symptom", "probable_cause", "corrective_action",
                    "content", "vector_dim", "embedding_stored", "embedding (BLOB)", "embedding_json",
                    "metadata", "created_at"
                ],
                "total_chunks_stored": total_chunks,
                "vector_embeddings_stored": vector_chunks,
                "distinct_machines": machines,
                "distinct_error_codes": error_codes,
                "sample_stored_records": sample_rows,
            }

    def count_all(self) -> dict[str, int]:
        """Count active records in SQLite storage."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM documents")
            d_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM chunks")
            c_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM reports")
            r_count = cursor.fetchone()[0]
            return {"documents": d_count, "chunks": c_count, "reports": r_count}


# Global singleton instance
_sqlite_storage: Optional[SQLiteStorage] = None


def get_sqlite_storage() -> SQLiteStorage:
    global _sqlite_storage
    if _sqlite_storage is None:
        _sqlite_storage = SQLiteStorage()
    return _sqlite_storage

