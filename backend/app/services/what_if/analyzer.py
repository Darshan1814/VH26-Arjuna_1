"""What-If Query Analyzer: intent detection, scenario classification, and prompt generation.

Classifies What-If queries into specific troubleshooting scenario types:
- continue_operation: "What if I continue running the machine?"
- test_fix: "What if I clean the ventilation?"
- fix_failed: "What if the recommended solution does not work?"
- action_comparison: "Which is better: cleaning ventilation or replacing the fan?"
- branching: "What if the cooling fan is working?"
- skip_step: "What if I skip the recommended step?"
- general: General hypothetical troubleshooting inquiries
"""

import logging
import re
from typing import Optional

from app.schemas.rag_response import (
    Citation,
    WhatIfAnalysis,
    WhatIfComparisonItem,
    WhatIfEvidenceItem,
)
from app.services.citations.citation_builder import CitationBuilder
from app.services.what_if.state_tracker import TroubleshootingState

logger = logging.getLogger(__name__)

# Intent detection regex patterns
WHAT_IF_PATTERNS = [
    re.compile(r"\bwhat\s+if\b", re.IGNORECASE),
    re.compile(r"^\s*if\s+i\b", re.IGNORECASE),
    re.compile(r"\bsuppose\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+happens\s+if\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+will\s+happen\s+if\b", re.IGNORECASE),
    re.compile(r"\bwhich\s+(?:option\s+is\s+)?better\b", re.IGNORECASE),
    re.compile(r"\bcan\s+i\s+skip\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+if\s+i\s+skip\b", re.IGNORECASE),
    re.compile(r"\bif\s+this\s+doesn't\s+work\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+if.*(?:doesn't|does\s+not)\s+work\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+if.*(?:already\s+working|is\s+working)\b", re.IGNORECASE),
]

# Scenario Classification Keywords
CONTINUE_KEYWORDS = [
    "continue running",
    "keep running",
    "continue operating",
    "keep operating",
    "continue to run",
    "keep using",
    "leave it running",
    "don't shut down",
    "not shutting down",
    "ignore error",
    "continue it",
    "run it",
]

FIX_FAILED_KEYWORDS = [
    "doesn't work",
    "does not work",
    "didn't work",
    "did not work",
    "doesn't fix",
    "does not fix",
    "solution does not work",
    "solution doesn't work",
    "persists",
    "still shows",
    "still overheating",
    "still happening",
    "problem continues",
    "fails to fix",
]

COMPARISON_KEYWORDS = [
    "which is better",
    "which option is better",
    "better to clean or replace",
    "better to replace or clean",
    "or should i",
    "versus",
    "vs",
    "compare",
]

BRANCHING_KEYWORDS = [
    "already working",
    "is working",
    "fan is working",
    "sensor is working",
    "is ok",
    "is not broken",
    "is operational",
    "check passed",
]

SKIP_KEYWORDS = [
    "skip",
    "bypass",
    "can i ignore",
    "without checking",
    "without replacing",
    "skip this step",
    "skip the recommended step",
]

TEST_FIX_KEYWORDS = [
    "clean",
    "replace",
    "swap",
    "change",
    "inspect",
    "adjust",
    "tighten",
    "refill",
    "reset",
    "try cleaning",
    "try replacing",
]


class WhatIfAnalyzer:
    """Analyzes and processes What-If troubleshooting inquiries."""

    def is_what_if_query(
        self,
        query: str,
        explicit_flag: Optional[bool] = None,
    ) -> bool:
        """Determine if a query is a hypothetical What-If inquiry."""
        if explicit_flag is True:
            return True

        for pattern in WHAT_IF_PATTERNS:
            if pattern.search(query):
                return True

        return False

    def classify_scenario(self, query: str, state: TroubleshootingState) -> str:
        """Classify the query into a specific What-If scenario type."""
        q_lower = query.lower()

        # 1. Action Comparison
        if any(kw in q_lower for kw in COMPARISON_KEYWORDS) and any(
            action in q_lower for action in ("clean", "replace", "check", "inspect", "fan", "ventilation")
        ):
            return "action_comparison"

        # 2. Fix Failed
        if any(kw in q_lower for kw in FIX_FAILED_KEYWORDS):
            return "fix_failed"

        # 3. Branching Scenario
        if any(kw in q_lower for kw in BRANCHING_KEYWORDS):
            return "branching"

        # 4. Continue Operation
        if any(kw in q_lower for kw in CONTINUE_KEYWORDS):
            return "continue_operation"

        # 5. Skip Step
        if any(kw in q_lower for kw in SKIP_KEYWORDS):
            return "skip_step"

        # 6. Test Fix
        if any(kw in q_lower for kw in TEST_FIX_KEYWORDS):
            return "test_fix"

        return "general"

    def build_augmented_search_query(
        self,
        query: str,
        state: TroubleshootingState,
        scenario_type: str,
    ) -> str:
        """Synthesize a context-augmented search query for RAG retrieval."""
        parts: list[str] = []

        # Include resolved machine model and error code
        if state.machine_model:
            parts.append(state.machine_model)
        if state.error_codes:
            parts.extend(state.error_codes)
        if state.symptoms:
            parts.extend(state.symptoms[:2])

        # Add domain terms based on scenario
        if scenario_type == "continue_operation":
            parts.extend(["continuous operation", "overheating risk", "protective shutdown", "cooling procedure", "safety"])
        elif scenario_type == "fix_failed":
            parts.extend(["alternative causes", "subsequent troubleshooting", "motor load", "secondary checks", "corrective steps"])
        elif scenario_type == "action_comparison":
            parts.extend(["cleaning ventilation", "cooling fan replacement", "maintenance priority", "diagnostic procedure"])
        elif scenario_type == "branching":
            parts.extend(["cooling fan functional", "ventilation inspection", "motor winding", "subsequent diagnostic step"])
        elif scenario_type == "skip_step":
            parts.extend(["safety requirement", "mandatory inspection", "diagnostic sequence", "warning"])
        elif scenario_type == "test_fix":
            parts.extend(["corrective action", "verification procedure", "inspection"])

        # Add original meaningful query tokens
        cleaned_query = re.sub(r"\b(what|if|i|the|a|an|is|it|can|does|which)\b", "", query, flags=re.IGNORECASE)
        parts.append(cleaned_query.strip())

        augmented = " ".join([p for p in parts if p]).strip()
        logger.info(f"Augmented What-If search query: {augmented}")
        return augmented

    def check_safety_hazard(self, query: str, scenario_type: str) -> Optional[str]:
        """Detect if an action constitutes an unsafe machine operation."""
        q_lower = query.lower()
        if scenario_type == "continue_operation" and any(k in q_lower for k in ("overheat", "smoke", "leak", "running")):
            return "Do not perform this action unless it is authorized by the machine's safety procedure."
        if any(k in q_lower for k in ("bypass", "override", "skip safety", "interlock", "ignore alarm")):
            return "Do not perform this action unless it is authorized by the machine's safety procedure."
        return None

    def format_what_if_markdown(
        self,
        analysis: WhatIfAnalysis,
        citations: list[Citation],
    ) -> str:
        """Format the What-If response according to Section 15 of user specification."""
        machine_name = analysis.current_situation.get("machine") or "Unknown Machine"
        problem_code = analysis.current_situation.get("error_code") or "Active fault"
        condition_desc = analysis.current_situation.get("condition") or "Troubleshooting condition"

        # Build Documented vs Inference vs Unknown sections
        doc_lines = "\n".join(f"- 📘 **Manual Evidence**: {fact}" for fact in analysis.documented_facts) if analysis.documented_facts else "- 📘 **Manual Evidence**: The available documentation does not state this explicitly."
        inf_lines = "\n".join(f"- 🧠 **Reasoned Inference**: {inf}" for inf in analysis.reasoned_inferences) if analysis.reasoned_inferences else "- 🧠 **Reasoned Inference**: Based on the condition, continued assessment is required."
        unk_lines = "\n".join(f"- ❓ **Unknown**: {unk}" for unk in analysis.unknowns) if analysis.unknowns else "- ❓ **Unknown**: The available documentation does not specify the exact timeline or quantitative limits."

        # Format sources
        formatted_sources = []
        for c in citations:
            src_str = CitationBuilder.format_citation_string(c)
            if src_str not in formatted_sources:
                formatted_sources.append(src_str)
        sources_block = "\n".join(f"- {s}" for s in formatted_sources) if formatted_sources else "- Available Machine Service Manuals"

        safety_block = ""
        if analysis.safety_warning:
            safety_block = f"\n> ⚠️ **Safety Warning**: {analysis.safety_warning}\n"

        # Format action comparison table if present
        comparison_block = ""
        if analysis.comparison_table:
            table_lines = [
                "\n**Action Comparison**\n",
                "| Action | Relevance / Condition | Intervention Level | Documented Support |",
                "| :--- | :--- | :--- | :--- |",
            ]
            for item in analysis.comparison_table:
                sup = "✅ Manual-supported" if item.manual_supported else "⚠️ Unverified"
                table_lines.append(f"| **{item.action}** | {item.relevance} | {item.intervention_level} | {sup} |")
            comparison_block = "\n".join(table_lines) + "\n"

        # Format timeline progression if present
        timeline_block = ""
        if analysis.timeline and len(analysis.timeline) > 1:
            timeline_lines = ["\n**Hypothetical Progression**"]
            for step in analysis.timeline:
                timeline_lines.append(f"- {step}")
            timeline_block = "\n".join(timeline_lines) + "\n"

        markdown_body = f"""### 🔮 What-If Analysis
{safety_block}
**Current Situation**
- **Machine**: {machine_name}
- **Problem**: {problem_code}
- **Condition**: {condition_desc}

**Hypothetical Action**
{analysis.hypothetical_action}

**Possible Outcome**
{doc_lines}
{inf_lines}
{comparison_block}{timeline_block}
**Why**
{analysis.why or "Analysis grounded in service manual diagnostics and documented causal pathways."}

**What is Unknown**
{unk_lines}

**Recommended Next Step**
{analysis.recommended_action or "Follow the documented manual inspection and verification procedure."}

**Sources**
{sources_block}"""

        return markdown_body.strip()
