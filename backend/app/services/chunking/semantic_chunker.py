"""Semantic intelligent chunking preserving section hierarchy, error codes, and pages."""

import re
from typing import Any, Optional

from app.services.metadata.metadata_extractor import MetadataExtractor


class SemanticChunker:
    """Chunks documents into semantic segments with overlap and metadata inheritance."""

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 80,
        target_chunk_size: Optional[int] = None,
    ) -> None:
        self.chunk_size = target_chunk_size if target_chunk_size is not None else chunk_size
        self.chunk_overlap = chunk_overlap
        self.meta_extractor = MetadataExtractor()

    def chunk_item(self, item: dict[str, Any]) -> list[dict[str, Any]]:
        """Split a normalized document item into overlapping semantic chunks."""
        content = (item.get("content") or item.get("text") or "").strip()
        if not content:
            return []

        page_num = item.get("page_number") or item.get("page", 1)
        machine_from_item = item.get("machine_model") or (item.get("metadata", {}).get("machine_model") if isinstance(item.get("metadata"), dict) else None)
        item_errors = item.get("error_codes", [])

        # Split into sentences or lines
        paragraphs = re.split(r"\n\s*\n|(?<=[.!?])\s+", content)
        chunks = []
        current_chunk_words: list[str] = []
        current_len = 0
        chunk_idx = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            words = para.split()
            para_len = len(words)

            if current_len + para_len > self.chunk_size and current_chunk_words:
                chunk_text = " ".join(current_chunk_words)
                meta = self.meta_extractor.extract(chunk_text, item.get("file_name", ""))
                inherited_errors = sorted(list(set(item_errors + meta["error_codes"])))

                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": chunk_text,
                    "page_number": page_num,
                    "page": page_num,
                    "section": item.get("section", "General"),
                    "machine_model": machine_from_item or meta.get("primary_machine"),
                    "error_codes": inherited_errors,
                    "source_type": item.get("source_type", "pdf"),
                    "file_name": item.get("file_name", ""),
                    "metadata": {
                        **item.get("metadata", {}),
                        "has_warnings": meta["has_warnings"],
                    },
                })
                chunk_idx += 1

                # Keep overlap words
                current_chunk_words = current_chunk_words[-self.chunk_overlap:] + words
                current_len = len(current_chunk_words)
            else:
                current_chunk_words.extend(words)
                current_len += para_len

        # Append final remaining chunk
        if current_chunk_words:
            chunk_text = " ".join(current_chunk_words)
            meta = self.meta_extractor.extract(chunk_text, item.get("file_name", ""))
            inherited_errors = sorted(list(set(item_errors + meta["error_codes"])))

            chunks.append({
                "chunk_index": chunk_idx,
                "content": chunk_text,
                "page_number": page_num,
                "page": page_num,
                "section": item.get("section", "General"),
                "machine_model": machine_from_item or meta.get("primary_machine"),
                "error_codes": inherited_errors,
                "source_type": item.get("source_type", "pdf"),
                "file_name": item.get("file_name", ""),
                "metadata": {
                    **item.get("metadata", {}),
                    "has_warnings": meta["has_warnings"],
                },
            })

        return chunks
