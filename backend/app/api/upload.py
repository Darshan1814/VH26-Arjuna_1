"""Multi-format knowledge upload API endpoint."""

import logging
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

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

    for upload in files:
        try:
            content = await upload.read()
            filename = upload.filename or "unknown"
            norm_doc = ingestion.process_file(content, filename, machine_model)
            processed_docs.append(norm_doc.to_dict())

            # Store chunks into Supabase if database is available
            chunks = []
            for item in norm_doc.items:
                chunks.extend(chunker.chunk_item(item))

            if chunks:
                try:
                    client = get_supabase_client()
                    # Ensure machine exists or create stub
                    effective_model = machine_model or norm_doc.machine_model or "Universal"
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
                            "error_codes": c["error_codes"],
                            "metadata": {
                                **c["metadata"],
                                "source_type": norm_doc.source_type,
                                "file_name": filename,
                            },
                            "embedding": embeddings[idx] if idx < len(embeddings) else None,
                        })

                    client.table("document_chunks").insert(db_rows).execute()
                    total_chunks_stored += len(db_rows)
                except Exception as db_err:
                    logger.warning(f"Database chunk insertion warning for {filename}: {db_err}")

        except Exception as e:
            logger.error(f"Error processing upload {upload.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process {upload.filename}: {str(e)}")

    return {
        "status": "success",
        "files_processed": len(files),
        "documents": processed_docs,
        "total_chunks_stored": total_chunks_stored,
    }
