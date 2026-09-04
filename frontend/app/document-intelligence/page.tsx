/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Youtube,
  BookOpen,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Download,
  Loader2,
  Sparkles,
  Play,
  Clock,
  User,
  ArrowRight,
  AlertTriangle,
  X,
  Layers,
  FileCheck,
  ListOrdered,
} from "lucide-react";
import { getApiBase } from "@/lib/api";
import { useLanguage } from "@/context/language-context";
import { downloadDirectPDF } from "@/lib/api";

interface VideoCard {
  title: string;
  link: string;
  channel: string;
  snippet: string;
  imageUrl: string;
  duration: string;
  source: string;
}

interface DocumentCard {
  title: string;
  link: string;
  snippet: string;
  section: string;
  source: string;
}

interface DocIntelligenceData {
  document_name: string;
  machine_model: string;
  page_count: number;
  executive_summary: string;
  what_to_do: string;
  key_action_items: string[];
  safety_precautions: string[];
  video_cards: VideoCard[];
  document_cards: DocumentCard[];
}

export default function DocumentIntelligencePage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [userNotes, setUserNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [result, setResult] = useState<DocIntelligenceData | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
    }
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Please select or upload a document file (PDF, TXT, DOCX).");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (userNotes.trim()) {
      formData.append("user_notes", userNotes.trim());
    }

    try {
      const res = await fetch(`${getApiBase()}/api/document-intelligence/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Analysis failed");
        throw new Error(`Error ${res.status}: ${errText}`);
      }

      const data: DocIntelligenceData = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error("Document Intelligence error:", err);
      setErrorMsg(err.message || "Failed to analyze document. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    setIsDownloadingPdf(true);

    try {
      const payload = {
        report_id: `DOC-${Date.now().toString().slice(-6)}`,
        query: `Manual Analysis: ${result.document_name}`,
        machine_model: result.machine_model,
        error_code: "DOC-BREAKDOWN",
        problem: `Deep Document Breakdown: ${result.document_name} (${result.page_count} pages)`,
        diagnosis: result.executive_summary,
        probable_causes: result.key_action_items,
        recommended_solutions: [
          {
            action: "Actionable Maintenance Protocol",
            priority: 1,
            reason: result.what_to_do,
          },
          ...result.video_cards.slice(0, 3).map((v, idx) => ({
            action: `[Video Guide] ${v.title} (${v.channel})`,
            priority: idx + 2,
            reason: v.snippet,
          })),
          ...result.document_cards.slice(0, 3).map((d, idx) => ({
            action: `[OEM Manual] ${d.title}`,
            priority: idx + 5,
            reason: d.snippet,
          })),
        ],
        safety_warnings: result.safety_precautions,
        proof_links: [
          ...result.video_cards.map((v) => ({ title: v.title, link: v.link, snippet: v.snippet, source: v.channel })),
          ...result.document_cards.map((d) => ({ title: d.title, link: d.link, snippet: d.snippet, source: d.source })),
        ],
      };

      await downloadDirectPDF(payload, `Manual_Intelligence_${result.machine_model.replace(/\s+/g, "_")}.pdf`);
    } catch (err: any) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF report: " + err.message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="w-full flex-1 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface-elevated)] to-[var(--color-surface)] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Document Intelligence & Video Learning Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
              Document Breakdown & Video Guide Generator
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed">
              Upload any machine manual, schematic, or service bulletin. The system extracts core architecture, explains what the document actually covers, generates an actionable maintenance roadmap, and produces YouTube video tutorials and OEM reference cards via live search.
            </p>
          </div>

          {result && (
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf}
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-medium shadow-sm transition hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap self-start md:self-center"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>Download B&W Intelligence Report</span>
            </button>
          )}
        </div>

        {/* Upload & Input Form */}
        <form onSubmit={handleAnalyze} className="mt-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
                selectedFile
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-elevated)]"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.txt,.docx,.md"
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose another
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] flex items-center justify-center">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      Drop technical manual (PDF, TXT, DOCX) here
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Supports equipment user guides, wiring diagrams, and parts catalogs
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* User Input Notes / Symptoms */}
            <div className="flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Optional: Focus Area or Symptoms Observed
                </label>
                <textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="e.g., Focus on drive inverter overcurrent alarm F001, spindle lubrication schedules, or replacement seal steps..."
                  rows={4}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !selectedFile}
                className="btn-primary inline-flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Parsing Document & Querying Media Guides...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Analyze Document & Generate Guides</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              Parsing Document Pages with PyMuPDF & Synthesizing Technical Analysis
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
              Extracting subsystem topology, formulating targeted YouTube video queries, and discovering manufacturer service documentation...
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      {result && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          {/* Top Metadata Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[var(--color-primary)]/10 p-2 text-[var(--color-primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text)]">{result.document_name}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Machine Model: <span className="font-semibold text-[var(--color-primary)]">{result.machine_model}</span> • {result.page_count} Pages Analyzed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                PyMuPDF Verified
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Neural Synthesized
              </span>
            </div>
          </div>

          {/* Section 1: What the Document Actually Covers (Executive Summary) */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-[var(--color-border-subtle)] pb-4 text-[var(--color-primary)]">
              <BookOpen className="h-5 w-5" />
              <h2 className="text-base font-bold text-[var(--color-text)]">
                Document Breakdown: What This Manual Actually Covers
              </h2>
            </div>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
              {result.executive_summary}
            </p>
          </div>

          {/* Section 2: "What to Do" Actionable Roadmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step-by-Step Instructions */}
            <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-[var(--color-border-subtle)] pb-4 text-[var(--color-primary)]">
                <ListOrdered className="h-5 w-5" />
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">
                    What To Do: Actionable Maintenance & Diagnostic Protocol
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Synthesized direct operational instructions for technicians
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {result.what_to_do}
              </p>

              {/* Key Action Items Checklist */}
              {result.key_action_items?.length > 0 && (
                <div className="pt-4 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Mandatory Action Items
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {result.key_action_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text)]"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Safety & Precautions Card */}
            <div className="rounded-2xl border border-red-200/80 bg-gradient-to-b from-red-50/60 via-[var(--color-surface-elevated)] to-red-50/30 p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    Safety & Precautions
                  </h3>
                </div>
                <div className="space-y-3">
                  {result.safety_precautions.map((warn, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-red-200 bg-white/80 text-xs text-red-800 leading-relaxed font-medium"
                    >
                      {warn}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-red-200/60 text-[11px] text-[var(--color-text-muted)]">
                Adhere strictly to OSHA Standard 1910.147 (Lockout/Tagout).
              </div>
            </div>
          </div>

          {/* Section 3: YouTube Video Tutorial Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
                  <Youtube className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">
                    Recommended YouTube Video Walkthroughs
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Curated video cards targeting {result.machine_model}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {result.video_cards.map((video, idx) => (
                <a
                  key={idx}
                  href={video.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden shadow-sm hover:shadow-md hover:border-red-500/40 transition flex flex-col justify-between"
                >
                  {/* Thumbnail with duration badge and play overlay */}
                  <div className="relative aspect-video w-full bg-neutral-900 overflow-hidden">
                    <img
                      src={video.imageUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                        <Play className="h-5 w-5 fill-white ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {video.duration}
                    </span>
                  </div>

                  {/* Body info */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[var(--color-text)] line-clamp-2 group-hover:text-red-600 transition">
                        {video.title}
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                        {video.snippet}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-1 truncate font-medium text-[var(--color-text)]">
                        <User className="h-3.5 w-3.5 text-neutral-400" />
                        {video.channel}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-red-500 group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Section 4: Document Reference Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-[var(--color-primary)]/10 p-2 text-[var(--color-primary)]">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-text)]">
                  OEM Service Manuals & Reference Cards
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Cross-referenced engineering documentation & service bulletins
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {result.document_cards.map((doc, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[var(--color-primary)]/40 transition group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                        {doc.section}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {doc.source}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition">
                      {doc.title}
                    </h4>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">
                      {doc.snippet}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-end">
                    <a
                      href={doc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <span>View Technical File</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Initial Empty State */}
      {!result && !isLoading && (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)] shadow-sm">
            <Upload className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              No Document Uploaded Yet
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
              Select or drop an industrial PDF manual above. The system will generate an executive breakdown, actionable maintenance steps, and YouTube video guides.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
