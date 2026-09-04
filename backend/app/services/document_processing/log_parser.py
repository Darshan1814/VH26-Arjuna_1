"""Log file parser extracting timestamps, severities, error codes, and messages."""

import re
from typing import Any

# Match standard log line: 2026-09-04 10:30:15 [ERROR] [CNC-X100] E101: Motor overheating
LOG_LINE_REGEX = re.compile(
    r"^(?P<timestamp>\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s*"
    r"(?:\[?(?P<severity>INFO|WARN|WARNING|ERROR|FATAL|CRITICAL|DEBUG)\]?)?\s*"
    r"(?:\[?(?P<machine>[A-Z0-9_-]+)\]?)?\s*"
    r"(?P<message>.*)$",
    re.IGNORECASE,
)

ERROR_CODE_REGEX = re.compile(r"\b(?:E-?\d{2,4}|ERR-?\d{2,4}|ALARM\s*\d{1,4})\b", re.IGNORECASE)


class LogParser:
    """Parses machine logs into structured entries."""

    @staticmethod
    def parse_log_text(log_content: str, file_name: str) -> dict[str, Any]:
        """Parse raw log file text into structured records and summary metadata."""
        lines = log_content.splitlines()
        entries = []
        error_codes_found = set()
        machines_found = set()

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            match = LOG_LINE_REGEX.match(line_str)
            if match:
                entry = match.groupdict()
                # Search error codes in message
                codes = ERROR_CODE_REGEX.findall(entry["message"] or "")
                entry["error_codes"] = [c.upper().replace(" ", "") for c in codes]
                for c in entry["error_codes"]:
                    error_codes_found.add(c)
                if entry.get("machine"):
                    machines_found.add(entry["machine"])
                entries.append(entry)
            else:
                codes = ERROR_CODE_REGEX.findall(line_str)
                cleaned_codes = [c.upper().replace(" ", "") for c in codes]
                for c in cleaned_codes:
                    error_codes_found.add(c)
                entries.append({
                    "timestamp": None,
                    "severity": "INFO",
                    "machine": None,
                    "message": line_str,
                    "error_codes": cleaned_codes,
                })

        return {
            "source_type": "log",
            "file_name": file_name,
            "total_lines": len(lines),
            "parsed_entries": entries,
            "detected_error_codes": sorted(list(error_codes_found)),
            "detected_machines": sorted(list(machines_found)),
            "content": log_content,
        }
