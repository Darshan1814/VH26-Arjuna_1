/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import {
  Search,
  BookOpen,
  FileText,
  ExternalLink,
  ShieldAlert,
  Zap,
  Download,
  Loader2,
  Sparkles,
  Layers,
  CheckCircle2,
  Bookmark,
  Share2,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { downloadDirectPDF } from "@/lib/api";

interface OEMBulletin {
  title: string;
  link: string;
  snippet: string;
  publisher: string;
  year: string;
}

interface ResearchPaper {
  title: string;
  link: string;
  snippet: string;
  publisher: string;
  year: string;
}

interface DocLink {
  title: string;
  link: string;
  snippet: string;
  category?: string;
}

interface ResearchData {
  query: string;
  machine_model: string;
  executive_briefing: string;
  physics_of_failure: string;
  industrial_consensus: string;
  oem_bulletins: OEMBulletin[];
  research_papers: ResearchPaper[];
  documentation_links: DocLink[];
  total_sources: number;
}

const PRESET_QUERIES = [
  { label: "Siemens V20 F001", query: "Siemens V20 F001 overcurrent fault", machine: "Siemens SINAMICS V20" },
  { label: "Fanuc 401 Servo Alarm", query: "Fanuc 401 VRDY OFF servo amplifier alarm", machine: "Fanuc Alpha i Series" },
  { label: "Spindle Bearing Thermal Runaway", query: "CNC spindle bearing thermal runaway high RPM", machine: "CNC Machining Center" },
  { label: "RoboArm Harmonic Backlash", query: "Industrial robot harmonic drive gear backlash wear", machine: "6-Axis Articulated Robot" },
  { label: "Hydraulic Cavitation ISO 4406", query: "Hydraulic pump cavitation and fluid contamination ISO 4406", machine: "High-Pressure Hydraulic Power Unit" },
];

export default function ErrorResearchPage() {
  const { t } = useLanguage();

  const [query, setQuery] = useState<string>("");
  const [machineModel, setMachineModel] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "papers" | "bulletins" | "docs">("all");

  const [researchResult, setResearchResult] = useState<ResearchData | null>(null);

  const handleSearch = async (searchQuery?: string, machine?: string) => {
    const q = (searchQuery !== undefined ? searchQuery : query).trim();
    if (!q) return;

    setIsLoading(true);
    setErrorMsg(null);

    const m = machine !== undefined ? machine : machineModel;

    try {
      const res = await fetch("http://localhost:8000/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          machine_model: m || undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Search failed");
        throw new Error(`Error ${res.status}: ${errText}`);
      }

      const data: ResearchData = await res.json();
      setResearchResult(data);
    } catch (err: any) {
      console.error("Research search error:", err);
      setErrorMsg(err.message || "Failed to search technical research. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!researchResult) return;
    setIsDownloadingPdf(true);
    try {
      const payload = {
        report_id: `RES-${Date.now().toString().slice(-6)}`,
        query: researchResult.query,
        machine_model: researchResult.machine_model,
        error_code: "OEM-LITERATURE-REVIEW",
        problem: `Literature and Field Research on: ${researchResult.query}`,
        diagnosis: researchResult.executive_briefing,
        probable_causes: [
          `Failure Physics: ${researchResult.physics_of_failure.slice(0, 250)}...`,
          `Consensus Resolution: ${researchResult.industrial_consensus.slice(0, 250)}...`,
        ],
        recommended_solutions: [
          ...researchResult.oem_bulletins.slice(0, 3).map((b, idx) => ({
            action: `[OEM Bulletin] ${b.title}`,
            priority: idx + 1,
            reason: b.snippet,
          })),
          ...researchResult.research_papers.slice(0, 3).map((p, idx) => ({
            action: `[Research Paper] ${p.title} (${p.publisher} ${p.year})`,
            priority: idx + 4,
            reason: p.snippet,
          })),
        ],
        safety_warnings: [
          "Always lock out / tag out (LOTO) energy sources before executing any repair from research documentation.",
          "Verify OEM torque and tolerance limits against physical nameplate specifications.",
        ],
        proof_links: [
          ...researchResult.oem_bulletins.map((b) => ({ title: b.title, link: b.link, snippet: b.snippet })),
          ...researchResult.research_papers.map((p) => ({ title: p.title, link: p.link, snippet: p.snippet })),
        ],
      };

      await downloadDirectPDF(payload, `Research_Briefing_${researchResult.machine_model.replace(/\s+/g, "_")}.pdf`);
    } catch (err: any) {
      console.error("Download error:", err);
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
              <span>OEM Bulletins & IEEE/ScienceDirect Research Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
              Industrial Error & Failure Research
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed">
              Investigate any machine fault, alarm code, or physical degradation mode. Our engine surfaces peer-reviewed research papers, OEM technical service bulletins, and manufacturer application notes via verified search with forensic engineering synthesis.
            </p>
          </div>

          {researchResult && (
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
              <span>Download B&W Research Report</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row items-stretch gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter error code, machine symptom, or failure mode (e.g., Siemens V20 F001 Overcurrent)..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] pl-11 pr-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              />
            </div>

            <input
              type="text"
              value={machineModel}
              onChange={(e) => setMachineModel(e.target.value)}
              placeholder="Machine context (optional)"
              className="w-full sm:w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
            />

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Searching Literature...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Analyze Error</span>
                </>
              )}
            </button>
          </form>

          {/* Preset Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">Quick Inquiries:</span>
            {PRESET_QUERIES.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(p.query);
                  setMachineModel(p.machine);
                  handleSearch(p.query, p.machine);
                }}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
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
              Querying Literature & Synthesizing Engineering Papers
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
              Scanning IEEE Xplore, ScienceDirect, ResearchGate, and OEM Technical Service Bulletins with forensic analysis...
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      {researchResult && !isLoading && (
        <div className="space-y-8 animate-fade-in">
          {/* Executive Synthesis Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Executive Briefing */}
            <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-[var(--color-primary)]/10 p-2 text-[var(--color-primary)]">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--color-text)]">
                      Executive Engineering Briefing
                    </h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Target Equipment: {researchResult.machine_model}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {researchResult.total_sources} Verified Sources
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {researchResult.executive_briefing}
              </p>
            </div>

            {/* Industrial Consensus & Standards */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-primary)]">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
                    Industry Consensus Standard
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {researchResult.industrial_consensus}
                </p>
              </div>

              <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>Compliance: ISO / IEEE / OSHA</span>
                <span className="font-semibold text-[var(--color-primary)]">Peer-Audited</span>
              </div>
            </div>
          </div>

          {/* Physics of Failure Box */}
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/50 via-[var(--color-surface-elevated)] to-amber-50/30 p-6 space-y-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-amber-800 font-semibold text-sm">
              <Zap className="h-4 w-4 text-amber-600" />
              <span>Forensic Mechanism & Physics of Failure</span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {researchResult.physics_of_failure}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
              }`}
            >
              All Citations ({researchResult.total_sources})
            </button>
            <button
              onClick={() => setActiveTab("papers")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                activeTab === "papers"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
              }`}
            >
              Research Papers ({researchResult.research_papers.length})
            </button>
            <button
              onClick={() => setActiveTab("bulletins")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                activeTab === "bulletins"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
              }`}
            >
              OEM Bulletins ({researchResult.oem_bulletins.length})
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                activeTab === "docs"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
              }`}
            >
              Technical Documentation ({researchResult.documentation_links.length})
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Academic Research Papers */}
            {(activeTab === "all" || activeTab === "papers") &&
              researchResult.research_papers.map((paper, idx) => (
                <div
                  key={`paper-${idx}`}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[var(--color-primary)]/40 transition group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {paper.publisher || "Research Paper"}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                        {paper.year || "2024"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition">
                      {paper.title}
                    </h4>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-4 leading-relaxed">
                      {paper.snippet}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                      Peer-Reviewed
                    </span>
                    <a
                      href={paper.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <span>Read Publication</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}

            {/* OEM Bulletins */}
            {(activeTab === "all" || activeTab === "bulletins") &&
              researchResult.oem_bulletins.map((bulletin, idx) => (
                <div
                  key={`bulletin-${idx}`}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[var(--color-primary)]/40 transition group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        {bulletin.publisher || "OEM Service Bulletin"}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                        {bulletin.year || "Verified"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition">
                      {bulletin.title}
                    </h4>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-4 leading-relaxed">
                      {bulletin.snippet}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                      Manufacturer Spec
                    </span>
                    <a
                      href={bulletin.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <span>Open OEM Bulletin</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}

            {/* Documentation Links */}
            {(activeTab === "all" || activeTab === "docs") &&
              researchResult.documentation_links.map((doc, idx) => (
                <div
                  key={`doc-${idx}`}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[var(--color-primary)]/40 transition group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-300">
                        {doc.category || "Documentation"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition">
                      {doc.title}
                    </h4>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-4 leading-relaxed">
                      {doc.snippet}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                      Support Portal
                    </span>
                    <a
                      href={doc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <span>View Manual</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Initial Empty State */}
      {!researchResult && !isLoading && (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)] shadow-sm">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              No Error Searched Yet
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
              Type an error code or machine fault above, or click one of the quick inquiries to pull live IEEE research papers and OEM service bulletins.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
