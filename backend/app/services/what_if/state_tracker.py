"""Troubleshooting state tracker for conversation context continuity.

Maintains and extracts structured troubleshooting state across chat turns:
- Machine identity (e.g., X100, CNC-X100, PRESS-Z200)
- Error codes (e.g., E101, ERR-42)
- Symptoms (e.g., High temperature, abnormal vibration, overheating)
- Component checks (e.g., Cooling fan = Working, Ventilation = Unknown)
- Working diagnosis (e.g., Motor overheating, bearing wear)
- Last recommended corrective steps

This ensures that anaphoric queries like "What if I continue running it?"
are properly grounded in the current conversation state rather than treated
as isolated or unknown.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Patterns for extracting machine models, error codes, and common symptoms
MACHINE_PATTERN = re.compile(r"\b([A-Z]{1,}[-_]?[A-Z0-9]{2,6})\b", re.IGNORECASE)
ERROR_CODE_PATTERN = re.compile(r"\b([A-Z]{1,3}[-_]?\d{2,5})\b", re.IGNORECASE)

KNOWN_SYMPTOMS = [
    "overheating",
    "high temperature",
    "excessive temperature",
    "elevated temperature",
    "abnormal vibration",
    "vibration",
    "strange noise",
    "excessive noise",
    "pressure loss",
    "low pressure",
    "high pressure",
    "oil leak",
    "fluid leak",
    "leakage",
    "smoke",
    "motor stall",
    "spindle lock",
    "tripping",
    "circuit breaker tripped",
    "speed fluctuation",
]

CHECK_PATTERNS = [
    (r"(?:cooling\s+)?fan\s+(?:is\s+)?(working|operational|running|ok|good|normal)", "cooling fan", "working"),
    (r"(?:cooling\s+)?fan\s+(?:is\s+)?(broken|faulty|failed|defective|not working|stopped)", "cooling fan", "defective"),
    (r"ventilation\s+(?:is\s+)?(clean|clear|unblocked|open)", "ventilation", "clear"),
    (r"ventilation\s+(?:is\s+)?(dirty|clogged|blocked|restricted)", "ventilation", "blocked"),
    (r"filter\s+(?:is\s+)?(clean|new|replaced)", "filter", "clean"),
    (r"filter\s+(?:is\s+)?(clogged|dirty|blocked)", "filter", "clogged"),
    (r"lubricant|oil\s+(?:level\s+is\s+)?(low|empty)", "lubrication", "low"),
    (r"lubricant|oil\s+(?:level\s+is\s+)?(normal|full|ok)", "lubrication", "normal"),
    (r"sensor\s+(?:is\s+)?(defective|faulty|failed)", "sensor", "defective"),
    (r"sensor\s+(?:is\s+)?(working|ok|calibrated)", "sensor", "working"),
]


@dataclass
class TroubleshootingState:
    """Structured machine troubleshooting state from conversation."""

    machine_model: Optional[str] = None
    machine_id: Optional[str] = None
    error_codes: list[str] = field(default_factory=list)
    symptoms: list[str] = field(default_factory=list)
    checks: dict[str, str] = field(default_factory=dict)
    diagnosis: Optional[str] = None
    last_recommended_actions: list[str] = field(default_factory=list)
    last_action_tested: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert state to a clean serializable dictionary."""
        return {
            "machine": self.machine_model or self.machine_id or "Unknown Machine",
            "error_code": self.error_codes[0] if self.error_codes else None,
            "condition": ", ".join(self.symptoms) if self.symptoms else (self.diagnosis or "Unspecified issue"),
            "symptoms": self.symptoms,
            "checks": self.checks,
            "diagnosis": self.diagnosis,
            "last_recommended_actions": self.last_recommended_actions,
        }


class TroubleshootingStateTracker:
    """Extracts and tracks machine troubleshooting state across chat turns."""

    def extract_state(
        self,
        conversation_history: Optional[list[dict]],
        current_query: str,
        preselected_machine_id: Optional[str] = None,
    ) -> TroubleshootingState:
        """Extract cumulative troubleshooting state from history and current query."""
        state = TroubleshootingState(machine_id=preselected_machine_id)

        all_texts: list[str] = []
        if conversation_history:
            for msg in conversation_history:
                content = msg.get("content", "")
                if content:
                    all_texts.append(content)

        all_texts.append(current_query)

        # 1. Detect Machine Models
        # First check explicit phrases like "Machine X100", "Model PRESS-Z200", etc.
        for text in reversed(all_texts):
            explicit_match = re.search(r"\b(?:machine|model)\s+[:#]?\s*([A-Za-z0-9-_]+)", text, re.IGNORECASE)
            if explicit_match:
                candidate = explicit_match.group(1).upper()
                if candidate not in ("ERROR", "IS", "HAS", "SHOWING", "WITH"):
                    state.machine_model = candidate
                    break

        # If not found via keyword, check standard machine patterns e.g. CNC-X100, PRESS-Z200
        if not state.machine_model:
            machine_regex = re.compile(r"\b([A-Z]{2,}[-_][A-Z0-9]+)\b", re.IGNORECASE)
            for text in reversed(all_texts):
                m = machine_regex.search(text)
                if m:
                    state.machine_model = m.group(1).upper()
                    break

        # Fallback to preselected_machine_id if provided
        if not state.machine_model and preselected_machine_id:
            clean_id = preselected_machine_id.replace("mach-", "").replace("machine-", "").upper()
            state.machine_model = clean_id

        # 2. Detect Error Codes (ignoring anything that is the machine model)
        for text in reversed(all_texts):
            matches = ERROR_CODE_PATTERN.findall(text)
            for code in matches:
                c_upper = code.upper()
                if state.machine_model and (c_upper == state.machine_model or c_upper in state.machine_model):
                    continue
                if c_upper not in state.error_codes:
                    state.error_codes.append(c_upper)

        # 3. Detect Symptoms
        combined_text = " ".join(all_texts).lower()
        for symptom in KNOWN_SYMPTOMS:
            if symptom in combined_text and symptom not in state.symptoms:
                state.symptoms.append(symptom.capitalize())

        # 4. Detect Component Checks
        for pattern, component, status in CHECK_PATTERNS:
            for text in reversed(all_texts):
                if re.search(pattern, text, re.IGNORECASE):
                    if component not in state.checks:
                        state.checks[component] = status
                    break

        # If ventilation not explicitly mentioned but fan checked, mark unknown
        if "cooling fan" in state.checks and "ventilation" not in state.checks:
            state.checks["ventilation"] = "unknown"

        # 5. Determine Diagnosis / Condition summary
        if "Overheating" in state.symptoms or "High temperature" in state.symptoms:
            state.diagnosis = "Possible motor or drive overheating"
        elif "Abnormal vibration" in state.symptoms:
            state.diagnosis = "Possible mechanical imbalance or bearing wear"
        elif state.error_codes:
            state.diagnosis = f"Active fault condition ({state.error_codes[0]})"
        elif state.symptoms:
            state.diagnosis = f"Active symptoms: {', '.join(state.symptoms[:2])}"
        else:
            state.diagnosis = "Machine operational issue"

        # 6. Extract last corrective step / recommended action from assistant messages
        if conversation_history:
            for msg in reversed(conversation_history):
                if msg.get("role") == "assistant":
                    content = msg.get("content", "")
                    # Look for bullet points or numbered steps
                    lines = [line.strip("- *0123456789. ") for line in content.split("\n") if line.strip()]
                    for line in lines:
                        if any(kw in line.lower() for kw in ("check", "clean", "replace", "inspect", "shut down", "verify", "recheck")):
                            if len(line) < 120 and line not in state.last_recommended_actions:
                                state.last_recommended_actions.append(line)
                    if state.last_recommended_actions:
                        break

        logger.info(
            f"Extracted troubleshooting state: machine={state.machine_model}, "
            f"error={state.error_codes}, checks={state.checks}"
        )
        return state
