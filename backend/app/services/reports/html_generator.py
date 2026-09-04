"""Interactive HTML troubleshooting report generator."""

import datetime
import html
from typing import Any


class HTMLReportGenerator:
    """Generates clean, interactive HTML diagnostic reports."""

    @staticmethod
    def generate(report_data: dict[str, Any]) -> str:
        """Render complete interactive HTML report document."""
        report_id = html.escape(str(report_data.get("report_id", "REP-001")))
        machine_model = html.escape(str(report_data.get("machine_model") or "Not Specified"))
        error_code = html.escape(str(report_data.get("error_code") or "N/A"))
        query = html.escape(str(report_data.get("query", "")))
        diagnosis = html.escape(str(report_data.get("diagnosis", "")))
        confidence_level = str(report_data.get("confidence_level", "HIGH")).upper()
        confidence_score = int(report_data.get("confidence", 0.85) * 100)

        # Badge color
        conf_badge_class = "badge-high" if confidence_level == "HIGH" else ("badge-med" if confidence_level == "MEDIUM" else "badge-low")

        # Probable causes
        causes_html = "".join(
            f'<li class="cause-item"><span class="cause-num">#{i}</span><span>{html.escape(c)}</span></li>'
            for i, c in enumerate(report_data.get("probable_causes", []), 1)
        )

        # Solutions
        solutions_html = ""
        for sol in report_data.get("recommended_solutions", []):
            priority = sol.get("priority", 1)
            action = html.escape(sol.get("action", ""))
            reason = html.escape(sol.get("reason", ""))
            evidence_str = html.escape(sol.get("evidence_strength", "Strong"))
            source = html.escape(sol.get("source", "Documentation"))
            solutions_html += f"""
            <div class="solution-card priority-{priority}">
                <div class="solution-header">
                    <span class="solution-badge">Priority {priority}</span>
                    <span class="evidence-tag">{evidence_str} Evidence</span>
                </div>
                <h4 class="solution-action">{action}</h4>
                <p class="solution-reason"><strong>Engineering Rationale:</strong> {reason}</p>
                <div class="solution-source"><strong>Source:</strong> {source}</div>
            </div>
            """

        # Warnings
        warnings_html = ""
        for w in report_data.get("safety_warnings", []):
            warnings_html += f'<div class="warning-box"><strong>⚠ SAFETY HAZARD:</strong> {html.escape(w)}</div>'

        # Evidence images
        evidence_html = ""
        for img_info in report_data.get("evidence_images", []):
            caption = html.escape(img_info.get("caption", "Source Manual Excerpt"))
            url = html.escape(img_info.get("url", ""))
            if url:
                evidence_html += f"""
                <div class="evidence-item">
                    <div class="evidence-caption">📄 {caption} (Yellow highlight marks technical excerpt)</div>
                    <img src="{url}" alt="{caption}" class="evidence-img" />
                </div>
                """

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Troubleshooting Report - {report_id}</title>
    <style>
        :root {{
            --bg: #ffffff;
            --surface: #f8fafc;
            --card: #ffffff;
            --border: #e2e8f0;
            --text: #0f172a;
            --muted: #64748b;
            --accent: #0284c7;
            --highlight: #fef08a;
        }}
        @media (prefers-color-scheme: dark) {{
            :root {{
                --bg: #0f172a;
                --surface: #1e293b;
                --card: #0f172a;
                --border: #334155;
                --text: #f8fafc;
                --muted: #94a3b8;
                --accent: #38bdf8;
                --highlight: #854d0e;
            }}
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--surface);
            color: var(--text);
            margin: 0;
            padding: 30px 15px;
            line-height: 1.5;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 36px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }}
        .header {{
            border-bottom: 2px solid var(--border);
            padding-bottom: 18px;
            margin-bottom: 24px;
        }}
        .header h1 {{
            margin: 0 0 6px 0;
            font-size: 22px;
            letter-spacing: -0.5px;
        }}
        .header p {{
            margin: 0;
            color: var(--muted);
            font-size: 13px;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
        }}
        .meta-cell {{
            font-size: 13px;
        }}
        .meta-cell span {{
            display: block;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .badge-high {{ color: #15803d; font-weight: 600; }}
        .badge-med {{ color: #b45309; font-weight: 600; }}
        .badge-low {{ color: #b91c1c; font-weight: 600; }}
        .section {{
            margin-bottom: 24px;
        }}
        .section-title {{
            font-size: 15px;
            font-weight: 700;
            border-bottom: 1px solid var(--border);
            padding-bottom: 6px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .cause-list {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}
        .cause-item {{
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 12px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 6px;
            margin-bottom: 6px;
            font-size: 13px;
        }}
        .cause-num {{
            font-weight: bold;
            color: var(--accent);
        }}
        .solution-card {{
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent);
            background: var(--surface);
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 12px;
        }}
        .solution-header {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }}
        .solution-badge {{
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            background: #e0f2fe;
            color: #0369a1;
            padding: 2px 8px;
            border-radius: 4px;
        }}
        .evidence-tag {{
            font-size: 11px;
            color: var(--muted);
        }}
        .solution-action {{
            margin: 0 0 6px 0;
            font-size: 14px;
        }}
        .solution-reason {{
            margin: 0 0 8px 0;
            font-size: 13px;
            color: var(--muted);
        }}
        .solution-source {{
            font-size: 12px;
            background: #fef9c3;
            color: #854d0e;
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
        }}
        .warning-box {{
            background: #fef2f2;
            border: 1px solid #f87171;
            color: #991b1b;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 13px;
            margin-bottom: 8px;
        }}
        .evidence-item {{
            margin-top: 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
        }}
        .evidence-caption {{
            background: var(--surface);
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            border-bottom: 1px solid var(--border);
        }}
        .evidence-img {{
            max-width: 100%;
            height: auto;
            display: block;
        }}
        .footer {{
            margin-top: 36px;
            padding-top: 14px;
            border-top: 1px solid var(--border);
            font-size: 11px;
            color: var(--muted);
            display: flex;
            justify-content: space-between;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Industrial Machine Troubleshooting System</h1>
            <p>Official Grounded Diagnostic & Corrective Action Report</p>
        </div>

        <div class="meta-grid">
            <div class="meta-cell"><span>Report ID</span><strong>{report_id}</strong></div>
            <div class="meta-cell"><span>Target Machine</span><strong>{machine_model}</strong></div>
            <div class="meta-cell"><span>Error Code</span><strong>{error_code}</strong></div>
            <div class="meta-cell"><span>Confidence</span><strong class="{conf_badge_class}">{confidence_level} ({confidence_score}%)</strong></div>
            <div class="meta-cell"><span>Generated</span><strong>{now_str}</strong></div>
        </div>

        <div class="section">
            <div class="section-title">1. Query & Problem Statement</div>
            <p style="font-size: 14px;"><strong>Operator Inquiry:</strong> <em>"{query}"</em></p>
        </div>

        <div class="section">
            <div class="section-title">2. Grounded Technical Diagnosis</div>
            <div style="font-size: 14px; line-height: 1.6; background: var(--surface); padding: 14px; border-radius: 6px; border: 1px solid var(--border);">
                {diagnosis}
            </div>
        </div>

        <div class="section">
            <div class="section-title">3. Probable Causes (Ranked)</div>
            <ul class="cause-list">{causes_html}</ul>
        </div>

        <div class="section">
            <div class="section-title">4. Recommended Corrective Actions</div>
            {solutions_html}
        </div>

        {f'<div class="section"><div class="section-title">5. Safety Precautions & Warnings</div>{warnings_html}</div>' if warnings_html else ''}

        {f'<div class="section"><div class="section-title">6. Source Documentation Evidence</div>{evidence_html}</div>' if evidence_html else ''}

        <div class="footer">
            <span>Generated by Industrial Machine Troubleshooting System</span>
            <span>Grounded Evidence Verification Enabled</span>
        </div>
    </div>
</body>
</html>"""
