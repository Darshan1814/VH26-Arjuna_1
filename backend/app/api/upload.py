"""Multi-format knowledge upload API endpoint with disk and database persistence."""

import os
import json
import logging
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.services.ingestion.multi_loader import MultiFormatIngestionService
from app.services.chunking.semantic_chunker import SemanticChunker
from app.services.embeddings.embedding_provider import EmbeddingProvider
from app.core.database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/knowledge")
async def upload_knowledge(
    files: list[UploadFile] = File(...),
    machine_model: Optional[str] = Form(None),
):
    """Universal upload endpoint accepting single or multiple PDFs, images, CSVs, logs, or TXT."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    ingestion = MultiFormatIngestionService()
    chunker = SemanticChunker()
    embedding_provider = EmbeddingProvider()

    processed_docs = []
    total_chunks_stored = 0

    os.makedirs(settings.MANUALS_DIR, exist_ok=True)

    for upload in files:
        try:
            content = await upload.read()
            filename = upload.filename or "unknown_manual.pdf"

            # 1. Always save file to local manuals directory for PyMuPDF highlighting and retrieval
            file_disk_path = os.path.join(settings.MANUALS_DIR, filename)
            with open(file_disk_path, "wb") as f:
                f.write(content)
            logger.info(f"Saved uploaded file to disk at: {file_disk_path} ({len(content)} bytes)")

            # 2. Ingest and extract structure
            norm_doc = ingestion.process_file(content, filename, machine_model)
            processed_docs.append(norm_doc.to_dict())

            # 3. Create semantic chunks
            chunks = []
            for item in norm_doc.items:
                chunks.extend(chunker.chunk_item(item))

            # 4. Save chunks to disk cache for guaranteed retrieval
            if chunks:
                chunks_cache_file = os.path.join(settings.MANUALS_DIR, f"{filename}.chunks.json")
                try:
                    with open(chunks_cache_file, "w", encoding="utf-8") as cf:
                        json.dump(chunks, cf, indent=2)
                    logger.info(f"Cached {len(chunks)} chunks to disk at {chunks_cache_file}")
                except Exception as c_err:
                    logger.warning(f"Could not write chunk cache: {c_err}")

                # 5. Insert into SQLite & Supabase
                clean_model = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
                effective_model = machine_model or norm_doc.machine_model or clean_model or "Industrial Equipment"
                try:
                    from app.core.sqlite_storage import get_sqlite_storage
                    sql_chunks = []
                    for c in chunks:
                        c_mach = c.get("machine_model") or effective_model
                        sql_chunks.append({
                            **c,
                            "filename": filename,
                            "file_name": filename,
                            "machine_model": c_mach,
                            "machine": c_mach,
                            "manual_id": filename,
                        })
                    get_sqlite_storage().save_chunks(sql_chunks)
                    logger.info(f"Saved {len(sql_chunks)} chunks to SQLite for {filename}")
                except Exception as sql_e:
                    logger.warning(f"Could not write chunks to SQLite: {sql_e}")

                try:
                    mach_res = client.table("machines").select("id").eq("model_number", effective_model).execute()
                    if mach_res.data:
                        machine_id = mach_res.data[0]["id"]
                    else:
                        new_mach = client.table("machines").insert({
                            "name": f"{effective_model} Equipment",
                            "model_number": effective_model,
                            "category": "Industrial Equipment",
                        }).execute()
                        machine_id = new_mach.data[0]["id"]

                    # Create manual entry
                    man_res = client.table("manuals").insert({
                        "machine_id": machine_id,
                        "title": filename,
                        "filename": filename,
                        "total_pages": len(norm_doc.items),
                        "status": "ready",
                    }).execute()
                    manual_id = man_res.data[0]["id"]

                    # Batch embed and insert chunks
                    texts = [c["content"] for c in chunks]
                    embeddings = embedding_provider.embed_batch(texts)

                    db_rows = []
                    for idx, c in enumerate(chunks):
                        db_rows.append({
                            "manual_id": manual_id,
                            "machine_id": machine_id,
                            "page_number": c["page_number"],
                            "section": c["section"],
                            "chunk_index": c["chunk_index"],
                            "content": c["content"],
                            "content_type": c.get("content_type", "text"),
                            "error_codes": c["error_codes"],
                            "metadata": {
                                **c["metadata"],
                                "source_type": norm_doc.source_type,
                                "file_name": filename,
                            },
                            "embedding": embeddings[idx] if idx < len(embeddings) else None,
                        })

                    client.table("document_chunks").insert(db_rows).execute()
                except Exception as db_err:
                    logger.warning(f"Database chunk insertion warning for {filename}: {db_err}")

                total_chunks_stored += len(chunks)

        except Exception as e:
            logger.error(f"Error processing upload {upload.filename}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to process {upload.filename}: {str(e)}")

    return {
        "status": "success",
        "files_processed": len(files),
        "documents": processed_docs,
        "total_chunks_stored": total_chunks_stored,
    }
