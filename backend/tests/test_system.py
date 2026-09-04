"""Automated system tests for the Industrial Machine Troubleshooting RAG application."""

import os
import pytest
from app.services.ingestion.detector import IngestionDetector
from app.services.ingestion.multi_loader import MultiFormatIngestionService
from app.services.disambiguation.machine_disambiguator import MachineDisambiguator
from app.services.retrieval.confidence_evaluator import ConfidenceEvaluator
from app.services.reports.pdf_generator import PDFReportGenerator
from app.services.reports.html_generator import HTMLReportGenerator
from app.services.chunking.semantic_chunker import SemanticChunker


def test_file_type_and_language_detection():
    """Test multi-format type detection and language identification."""
    detector = IngestionDetector()
    
    # Test text detection
    res_txt = detector.detect(b"Error E101: Spindle motor overload. Check ventilation ducts.", "manual.txt")
    assert res_txt.detected_type == "text"
    assert res_txt.language == "en"
    
    # Test CSV detection
    res_csv = detector.detect(b"ErrorCode,Component,Threshold\nE101,Spindle,85C\n", "errors.csv")
    assert res_csv.detected_type == "csv"
    
    # Test Log detection
    res_log = detector.detect(b"[2026-09-04 10:00:00] [CRITICAL] [CNC-X100] [E101] Thermal trip\n", "sys.log")
    assert res_log.detected_type == "log"


def test_cross_manual_disambiguation():
    """Test that ambiguous error codes across multiple machines trigger disambiguation."""
    disambiguator = MachineDisambiguator()
    
    # Candidate manuals containing E101 for different machines
    candidates = [
        {"machine_model": "CNC-X100", "error_codes": ["E101"], "content": "Spindle motor thermal overload"},
        {"machine_model": "PRESS-Z200", "error_codes": ["E101"], "content": "Hydraulic pressure sensor fault"},
    ]
    
    # Ambiguous query without specified machine
    eval_res = disambiguator.evaluate(
        query="What does error E101 mean?",
        detected_error_code="E101",
        detected_machine=None,
        candidate_chunks=candidates,
    )
    
    assert eval_res.is_ambiguous is True
    assert "CNC-X100" in eval_res.candidate_machines
    assert "PRESS-Z200" in eval_res.candidate_machines
    
    # Resolved query with specified machine
    eval_res_resolved = disambiguator.evaluate(
        query="What does error E101 mean on CNC-X100?",
        detected_error_code="E101",
        detected_machine="CNC-X100",
        candidate_chunks=candidates,
    )
    assert eval_res_resolved.is_ambiguous is False


def test_confidence_evaluation():
    """Test multi-signal confidence evaluation."""
    evaluator = ConfidenceEvaluator()
    
    # High confidence case
    res_high = evaluator.evaluate(
        query="E101 spindle overload",
        retrieved_chunks=[
            {"relevance_score": 0.92, "content": "E101 indicates spindle motor thermal trip"},
            {"relevance_score": 0.88, "content": "Inspect cooling fans and heat sink"},
        ],
        matched_error_code=True,
    )
    assert res_high["level"] == "HIGH"
    assert res_high["score"] >= 0.8
    
    # Low confidence case (no error code match, low relevance)
    res_low = evaluator.evaluate(
        query="E999 mysterious alien frequency",
        retrieved_chunks=[
            {"relevance_score": 0.25, "content": "General maintenance notes"},
        ],
        matched_error_code=False,
    )
    assert res_low["level"] == "LOW"
    assert res_low["score"] < 0.5


def test_pdf_report_generation(tmp_path):
    """Test generating a professional black-and-white PDF report with ReportLab."""
    payload = {
        "report_id": "TEST101",
        "query": "E101 Spindle motor thermal trip",
        "machine_model": "CNC-X100",
        "error_code": "E101",
        "problem": "Spindle motor temperature reached critical threshold (95°C)",
        "diagnosis": "Cooling fan shroud obstructed with particulate buildup",
        "probable_causes": ["Blocked air filter", "Continuous heavy cutting feed rate"],
        "recommended_solutions": [
            {
                "priority": 1,
                "action": "Clean spindle motor cooling fins and replace dust filter",
                "reason": "Directly restores thermal dissipation efficiency",
                "evidence_strength": "Strong",
                "source": "CNC-X100 Manual, Section 4.2, Page 42",
            }
        ],
        "safety_warnings": ["Isolate main 480V circuit breaker before opening cabinet"],
        "confidence_level": "HIGH",
        "confidence": 0.95,
        "evidence_images": [],
    }
    
    pdf_path = PDFReportGenerator.generate(payload, "test_report.pdf")
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 1000  # Generated valid PDF bytes


def test_html_report_generation():
    """Test generating an interactive HTML diagnostic report."""
    payload = {
        "report_id": "HTMLTEST",
        "query": "E101 Spindle thermal trip",
        "machine_model": "CNC-X100",
        "error_code": "E101",
        "problem": "Spindle motor thermal trip",
        "diagnosis": "Motor temperature exceeded 90C limit",
        "probable_causes": ["Air duct blockage"],
        "recommended_solutions": [
            {
                "priority": 1,
                "action": "Clear ventilation duct",
                "reason": "Restores airflow",
                "evidence_strength": "Strong",
                "source": "Section 3, Page 12",
            }
        ],
        "safety_warnings": ["De-energize machine prior to inspection"],
        "confidence_level": "HIGH",
        "confidence": 0.92,
        "evidence_images": [],
    }
    
    html = HTMLReportGenerator.generate(payload)
    assert "HTMLTEST" in html
    assert "CNC-X100" in html
    assert "De-energize machine prior to inspection" in html
    assert "Clear ventilation duct" in html


def test_semantic_chunker():
    """Test chunking with error code preservation."""
    chunker = SemanticChunker(target_chunk_size=100, chunk_overlap=20)
    item = {
        "text": "Chapter 4: Spindle Unit. Error E101 represents a thermal overload. When E101 triggers, immediately stop the feed cycle and verify that the external blower is rotating.",
        "page_number": 42,
        "section": "Spindle Unit",
        "error_codes": ["E101"],
        "metadata": {"machine_model": "CNC-X100"},
    }
    
    chunks = chunker.chunk_item(item)
    assert len(chunks) >= 1
    assert chunks[0]["page_number"] == 42
    assert "E101" in chunks[0]["error_codes"]
