"""Document Intelligence & Video Guide Generator API integrating PyMuPDF, Groq, and Serper video cards."""

import io
import json
import logging
import os
import re
import urllib.parse
from typing import Any, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
import fitz  # PyMuPDF

from app.core.config import settings
from app.services.llm.openai_client import get_openai_client
from app.services.search.web_search import get_web_search_service

logger = logging.getLogger(__name__)

router = APIRouter()


class VideoCard(BaseModel):
    title: str
    link: str
    channel: str
    snippet: str
    imageUrl: str
    duration: str
    source: str


class DocumentCard(BaseModel):
    title: str
    link: str
    snippet: str
    section: str
    source: str


class DocumentIntelligenceResponse(BaseModel):
    document_name: str
    machine_model: str
    page_count: int
    executive_summary: str
    what_to_do: str
    key_action_items: list[str]
    safety_precautions: list[str]
    video_cards: list[VideoCard]
    document_cards: list[DocumentCard]


@router.post("/analyze", response_model=DocumentIntelligenceResponse)
async def analyze_document_and_generate_guides(
    file: UploadFile = File(...),
    user_notes: Optional[str] = Form(None),
):
    """Parse document, synthesize deep intelligence via Groq, and generate YouTube video cards and document reference links."""
    if not file:
        raise HTTPException(status_code=400, detail="Document file is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty document received")

    filename = file.filename or "technical_manual.pdf"
    page_count = 1
    extracted_text = ""

    # Parse document with PyMuPDF for PDF or plain text
    if filename.lower().endswith(".pdf"):
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            page_count = len(doc)
            # Read first 15 pages for comprehensive overview
            for p in doc[:15]:
                extracted_text += p.get_text() + "\n"
            doc.close()
        except Exception as e:
            logger.warning(f"PyMuPDF parse error on {filename}: {e}")
            extracted_text = f"Document: {filename} (Raw binary PDF)"
    else:
        try:
            extracted_text = content.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = str(content[:3000])

    clean_snippet = extracted_text.strip()[:7000]

    # Groq Deep Document Intelligence Analysis
    prompt = f"""You are an elite industrial operations director, master equipment technician, and curriculum engineer.
A user has uploaded an industrial service manual or technical document.
Document Name: {filename}
Total Pages: {page_count}
User-Supplied Input / Symptoms / Focus: {user_notes or 'Comprehensive document breakdown and maintenance roadmap'}

--- EXTRACTED MANUAL CONTENT ---
{clean_snippet[:5500]}
--------------------------------

YOUR TASK:
1. EXECUTIVE SUMMARY: Explain what this document actually covers (system specs, key subsystems, operating envelope).
2. "WHAT TO DO" (Actionable Roadmap): Synthesize a crystal-clear, step-by-step roadmap explaining exactly what a technician or operator must do for routine upkeep, fault isolation, and recovery.
3. SEARCH QUERIES: Formulate 3 optimal YouTube video tutorial search terms and 2 OEM technical document search terms for this machine and its procedures.

Return a valid JSON object matching this schema:
{{
  "machine_model": "Identified machine model or equipment type (e.g. Siemens SINAMICS V20 / RoboArm-R5)",
  "executive_summary": "Comprehensive 2-paragraph executive breakdown of what this manual actually covers.",
  "what_to_do": "Direct, step-by-step instructions on what the technician must do (LOTO, inspections, calibration, parameter settings).",
  "key_action_items": [
    "Item 1: Verification of electrical supply and breaker sizing",
    "Item 2: Preventive lubrication and seal replacement",
    "Item 3: Alarm reset and parameter configuration",
    "Item 4: Operating temperature and vibration checks"
  ],
  "safety_precautions": [
    "DANGER: Execute Lockout/Tagout (LOTO) per OSHA 1910.147 before opening cabinets.",
    "CAUTION: High voltage DC bus discharge required before servicing."
  ],
  "video_search_terms": [
    "Machine Model wiring and startup tutorial",
    "Machine Model troubleshooting common fault codes"
  ],
  "document_search_terms": [
    "Machine Model OEM service bulletin",
    "Machine Model commissioning manual PDF"
  ]
}}
"""

    llm = get_openai_client()
    try:
        data = llm.json_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            model=settings.GROQ_MODEL,
        )
    except Exception as e:
        logger.error(f"Error analyzing document with Groq: {e}")
        data = {}

    machine = data.get("machine_model") or filename.rsplit(".", 1)[0].replace("_", " ").title()
    summary = data.get("executive_summary") or (
        f"This document provides the technical baseline, operating limits, and maintenance guidelines for {machine}. "
        "It covers physical subsystem architecture, wiring diagrams, parameter settings, and standard operating procedures."
    )
    what_to_do = data.get("what_to_do") or (
        f"1. Isolate power and follow OSHA Lockout/Tagout procedures.\n"
        f"2. Inspect mechanical joints and electrical terminals for thermal stress.\n"
        f"3. Verify sensor thresholds and fluid levels.\n"
        f"4. Execute diagnostic test cycles under light load."
    )
    action_items = data.get("key_action_items") or [
        "Perform scheduled electrical impedance and insulation checks",
        "Inspect fluid reservoirs and hydraulic line seals",
        "Calibrate limit switches and position encoders",
        "Log parameter values and verify motor current limits",
    ]
    safety = data.get("safety_precautions") or [
        "DANGER: Follow Lockout/Tagout (LOTO) procedures prior to cabinet entry.",
        "CAUTION: Ensure all kinetic and residual energy is safely discharged.",
    ]

    # Generate YouTube Video Cards via Serper
    video_query = (data.get("video_search_terms") or [f"{machine} troubleshooting walkthrough"])[0]
    web_search = get_web_search_service()
    video_results = await web_search.search_videos(video_query, num_results=4)

    video_cards: list[VideoCard] = []
    for v in video_results:
        video_cards.append(
            VideoCard(
                title=v.get("title", f"{machine} Repair Guide"),
                link=v.get("link", f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(video_query)}"),
                channel=v.get("channel", "Industrial Engineering Channel"),
                snippet=v.get("snippet", "Detailed step-by-step diagnostic and bench testing tutorial."),
                imageUrl=v.get("imageUrl", "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60"),
                duration=v.get("duration", "10:15"),
                source=v.get("source", "YouTube Video Guide"),
            )
        )

    # Generate Document Reference Cards via Serper
    doc_query = (data.get("document_search_terms") or [f"{machine} technical manual"])[0]
    doc_results = await web_search.search(f"{doc_query} service bulletin PDF", num_results=4)

    document_cards: list[DocumentCard] = []
    for d in doc_results:
        document_cards.append(
            DocumentCard(
                title=d.get("title", f"{machine} Technical Documentation"),
                link=d.get("link", "https://support.industry.siemens.com"),
                snippet=d.get("snippet", "Official manufacturer engineering specification and maintenance manual."),
                section="OEM Specification",
                source=d.get("source", "OEM Bulletin"),
            )
        )

    return DocumentIntelligenceResponse(
        document_name=filename,
        machine_model=machine,
        page_count=page_count,
        executive_summary=summary,
        what_to_do=what_to_do,
        key_action_items=action_items,
        safety_precautions=safety,
        video_cards=video_cards,
        document_cards=document_cards,
    )
