"""CSV and tabular data extraction service."""

import csv
import io
from typing import Any


class TableExtractor:
    """Extracts columns, row counts, and error occurrences from CSV and tabular data."""

    @staticmethod
    def parse_csv(csv_bytes: bytes, file_name: str) -> dict[str, Any]:
        """Parse CSV bytes into header, records, and text representation."""
        text = csv_bytes.decode("utf-8", errors="replace")
        f = io.StringIO(text)
        reader = csv.reader(f)

        rows = list(reader)
        if not rows:
            return {
                "source_type": "csv",
                "file_name": file_name,
                "row_count": 0,
                "columns": [],
                "content": "",
            }

        headers = rows[0]
        records = rows[1:]

        # Format as markdown table for embedding & LLM inspection
        header_line = "| " + " | ".join(headers) + " |"
        sep_line = "| " + " | ".join(["---"] * len(headers)) + " |"
        sample_rows = ["| " + " | ".join(r) + " |" for r in records[:50]]
        table_markdown = "\n".join([header_line, sep_line] + sample_rows)

        return {
            "source_type": "csv",
            "file_name": file_name,
            "row_count": len(records),
            "columns": headers,
            "sample_rows": records[:10],
            "content": table_markdown,
        }
