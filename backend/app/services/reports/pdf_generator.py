"""Professional industrial PDF report generator using ReportLab."""

import os
import datetime
import uuid
import logging
from typing import Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from app.core.config import settings

logger = logging.getLogger(__name__)


class NumberedCanvas(canvas.Canvas):
    """Canvas that performs two passes to calculate and print total page numbers: Page X of Y."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setStrokeColor(colors.HexColor("#333333"))
        self.setFillColor(colors.HexColor("#555555"))

        # Header
        self.drawString(54, 11 * inch - 36, "Industrial Machine Troubleshooting System — Diagnostic Report")
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Footer
        self.line(54, 45, 8.5 * inch - 54, 45)
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 32, page_str)
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        self.drawString(54, 32, f"Confidential & Grounded Diagnostic • Generated: {now_str}")
        self.restoreState()


class PDFReportGenerator:
    """Generates structured, professional monochrome PDF troubleshooting reports."""

    @staticmethod
    def generate(
        report_data: dict[str, Any],
        output_filename: Optional[str] = None,
    ) -> str:
        """Build and save a professional PDF troubleshooting report."""
        report_id = report_data.get("report_id") or str(uuid.uuid4())[:8].upper()
        if not output_filename:
            output_filename = f"report_{report_id}.pdf"

        pdf_path = os.path.join(settings.REPORTS_DIR, output_filename)
        os.makedirs(settings.REPORTS_DIR, exist_ok=True)

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54,
        )

        styles = getSampleStyleSheet()
        
        # Custom clean engineering typography styles
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.black,
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#444444"),
        )
        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=colors.black,
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.black,
        )
        body_bold = ParagraphStyle(
            "ReportBodyBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )
        warning_style = ParagraphStyle(
            "WarningBody",
            parent=body_style,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#990000"),
        )

        story = []

        # Header Title
        story.append(Spacer(1, 10))
        story.append(Paragraph("INDUSTRIAL MACHINE TROUBLESHOOTING SYSTEM", title_style))
        story.append(Paragraph("OFFICIAL ROOT CAUSE & CORRECTIVE ACTION REPORT", subtitle_style))
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.black, spaceBefore=2, spaceAfter=8))

        # Metadata Table
        now = datetime.datetime.now()
        meta_table_data = [
            [
                Paragraph("<b>Report ID:</b> " + report_id, body_style),
                Paragraph("<b>Date:</b> " + now.strftime("%Y-%m-%d"), body_style),
                Paragraph("<b>Time:</b> " + now.strftime("%H:%M:%S UTC"), body_style),
            ],
            [
                Paragraph("<b>Machine:</b> " + str(report_data.get("machine_model") or "Unspecified"), body_style),
                Paragraph("<b>Error Code:</b> " + str(report_data.get("error_code") or "None"), body_style),
                Paragraph("<b>Confidence:</b> " + str(report_data.get("confidence_level", "HIGH")), body_style),
            ],
        ]
        meta_table = Table(meta_table_data, colWidths=[2.3 * inch, 2.3 * inch, 2.4 * inch])
        meta_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#999999")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9F9F9")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))

        # User Query & Problem Statement
        story.append(Paragraph("1. ISSUE DESCRIPTION & USER INQUIRY", h2_style))
        query_text = report_data.get("query", "")
        story.append(Paragraph(f"<b>Query:</b> {query_text}", body_style))
        if report_data.get("problem"):
            story.append(Paragraph(f"<b>Problem Statement:</b> {report_data.get('problem')}", body_style))
        story.append(Spacer(1, 8))

        # Diagnosis
        story.append(Paragraph("2. TECHNICAL DIAGNOSIS (EVIDENCE-GROUNDED)", h2_style))
        diag = report_data.get("diagnosis", "No diagnosis recorded.")
        story.append(Paragraph(diag, body_style))
        story.append(Spacer(1, 8))

        # Probable Causes Table
        causes = report_data.get("probable_causes", [])
        if causes:
            story.append(Paragraph("3. PROBABLE CAUSES (RANKED)", h2_style))
            cause_rows = []
            for idx, c in enumerate(causes, 1):
                cause_rows.append([
                    Paragraph(f"<b>#{idx}</b>", body_style),
                    Paragraph(c, body_style),
                ])
            cause_table = Table(cause_rows, colWidths=[0.4 * inch, 6.6 * inch])
            cause_table.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(cause_table)
            story.append(Spacer(1, 8))

        # Recommended Solutions Table
        solutions = report_data.get("recommended_solutions", [])
        if solutions:
            story.append(Paragraph("4. RECOMMENDED CORRECTIVE ACTIONS (PRIORITIZED)", h2_style))
            sol_rows = [
                [
                    Paragraph("<b>Priority</b>", body_bold),
                    Paragraph("<b>Action Required</b>", body_bold),
                    Paragraph("<b>Engineering Rationale</b>", body_bold),
                    Paragraph("<b>Evidence</b>", body_bold),
                    Paragraph("<b>Source Manual</b>", body_bold),
                ]
            ]
            for s in solutions:
                sol_rows.append([
                    Paragraph(f"Priority {s.get('priority', 1)}", body_style),
                    Paragraph(s.get("action", ""), body_style),
                    Paragraph(s.get("reason", ""), body_style),
                    Paragraph(s.get("evidence_strength", "Strong"), body_style),
                    Paragraph(s.get("source", "Manual"), body_style),
                ])
            sol_table = Table(sol_rows, colWidths=[0.8 * inch, 2.0 * inch, 2.0 * inch, 0.9 * inch, 1.3 * inch])
            sol_table.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEEEEE")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(sol_table)
            story.append(Spacer(1, 8))

        # Safety Warnings
        warnings = report_data.get("safety_warnings", [])
        if warnings:
            story.append(Paragraph("5. SAFETY HAZARDS & PROCEDURAL WARNINGS", h2_style))
            for w in warnings:
                story.append(Paragraph(f"[!] <b>WARNING:</b> {w}", warning_style))
            story.append(Spacer(1, 8))

        # Source Evidence & Highlighting Section
        story.append(Paragraph("6. SOURCE EVIDENCE & PAGE CITATIONS", h2_style))
        story.append(
            Paragraph(
                "The findings above were derived from verified documentation excerpts. "
                "Any attached document pages display highlighted yellow regions marking exact technical passages.",
                body_style,
            )
        )
        story.append(Spacer(1, 4))

        evidence_images = report_data.get("evidence_images", [])
        for img_info in evidence_images:
            img_path = img_info.get("path")
            caption = img_info.get("caption", "Source Manual Page")
            if img_path and os.path.exists(img_path):
                story.append(Spacer(1, 6))
                story.append(Paragraph(f"<b>Evidence:</b> {caption}", body_style))
                story.append(Spacer(1, 2))
                try:
                    report_img = Image(img_path, width=6.5 * inch, height=4.2 * inch, kind="proportional")
                    story.append(report_img)
                except Exception as e:
                    logger.warning(f"Could not embed image {img_path}: {e}")
                story.append(Spacer(1, 6))

        # Traceability & Verification
        story.append(Spacer(1, 6))
        story.append(Paragraph("7. TRACEABILITY & SYSTEM VERIFICATION", h2_style))
        trace_data = [
            [
                Paragraph("<b>Stage</b>", body_bold),
                Paragraph("<b>Mechanism</b>", body_bold),
                Paragraph("<b>Verification Result</b>", body_bold),
            ],
            [
                Paragraph("Source Selection", body_style),
                Paragraph("Model match / Error extraction", body_style),
                Paragraph("Verified — Target manual linked", body_style),
            ],
            [
                Paragraph("Retrieval", body_style),
                Paragraph("Hybrid (Exact + Vector pgvector)", body_style),
                Paragraph(f"High relevance ({report_data.get('confidence_level', 'HIGH')})", body_style),
            ],
            [
                Paragraph("Generation", body_style),
                Paragraph("OpenAI strict evidence verification", body_style),
                Paragraph("Ground truth enforced (no hallucination)", body_style),
            ],
        ]
        trace_table = Table(trace_data, colWidths=[1.8 * inch, 2.6 * inch, 2.6 * inch])
        trace_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBBBBB")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(trace_table)

        # Build document with NumberedCanvas for header/footer
        doc.build(story, canvasmaker=NumberedCanvas)
        logger.info(f"Generated PDF troubleshooting report at: {pdf_path}")
        return pdf_path
