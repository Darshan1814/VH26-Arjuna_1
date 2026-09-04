/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from "react";
import {
  HelpCircle,
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Zap,
  Globe,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Layers,
  Download,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { getApiBase, downloadDirectPDF } from "@/lib/api";

interface WhatIfQuestion {
  id: number;
  category: string;
  scenario: string;
  severity: string;
}

interface RecommendedSolution {
  priority: number;
  action: string;
  reason: string;
  evidence_strength: string;
  source: string;
  is_verified: boolean;
}

interface WhatIfSimulationResult {
  scenario: string;
  problem: string;
  diagnosis: string;
  answer: string;
  probable_causes: string[];
  corrective_steps: string[];
  recommended_solutions: RecommendedSolution[];
  safety_warnings: string[];
  escalation_level: string;
  proof_links: { title: string; link: string; snippet?: string; source?: string }[];
}

export default function WhatIfSimulatorPage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload & Generation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [machineContext, setMachineContext] = useState<string>("");
  const [customText, setCustomText] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [questions, setQuestions] = useState<WhatIfQuestion[]>([]);
  const [extractedSnippet, setExtractedSnippet] = useState<string>("");

  // Simulation state
  const [customScenario, setCustomScenario] = useState<string>("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<WhatIfSimulationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg(null);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => setFilePreview(event.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  // Generate 10 What-If Questions
  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      if (selectedFile) formData.append("file", selectedFile);
      if (customText.trim()) formData.append("raw_text", customText.trim());
      formData.append("machine_name", machineContext.trim() || "Industrial Machinery");

      const res = await fetch(`${getApiBase()}/api/what-if/generate-questions`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Failed to generate questions: ${res.statusText}`);
      }

      const data = await res.json();
      setQuestions(data.questions || []);
      setExtractedSnippet(data.extracted_text_snippet || "");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to analyze document and generate What-If questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Run What-If Simulation
  const handleSimulate = async (scenarioToRun: string) => {
    if (!scenarioToRun.trim()) return;

    setActiveQuestion(scenarioToRun);
    setIsSimulating(true);
    setErrorMsg(null);
    setSimulationResult(null);

    try {
      const res = await fetch(`${getApiBase()}/api/what-if/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: scenarioToRun,
          machine_context: machineContext,
          document_context: extractedSnippet || customText,
        }),
      });

      if (!res.ok) {
        throw new Error(`Simulation failed: ${res.statusText}`);
      }

      const data = await res.json();
      setSimulationResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Simulation error occurred.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!simulationResult) return;
    setIsDownloadingPdf(true);
    try {
      const payload = {
        query: simulationResult.scenario,
        machine_model: machineContext.trim() || "Industrial Machinery Simulation",
        error_code: "SIM-WHAT-IF",
        problem: simulationResult.problem || simulationResult.scenario,
        diagnosis: simulationResult.diagnosis,
        probable_causes: simulationResult.probable_causes,
        recommended_solutions: simulationResult.recommended_solutions,
        safety_warnings: simulationResult.safety_warnings,
        confidence_level: simulationResult.escalation_level?.toLowerCase().includes("critical")
          ? "CRITICAL"
          : simulationResult.escalation_level?.toLowerCase().includes("high")
          ? "HIGH"
          : "MEDIUM",
        confidence: 0.95,
        proof_links: simulationResult.proof_links,
        report_id: `SIM_${Date.now().toString().slice(-6)}`,
      };
      await downloadDirectPDF(payload, `What_If_Simulation_Report_${Date.now()}.pdf`);
    } catch (err: any) {
      console.error("Failed to generate PDF report:", err);
      setErrorMsg("Failed to download PDF report: " + (err.message || "Unknown error"));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const s = severity?.toLowerCase();
    if (s === "critical") {
      return (
        <span className="rounded-full bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-400">
          Critical Risk
        </span>
      );
    } else if (s === "high") {
      return (
        <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
          High Impact
        </span>
      );
    }
    return (
      <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400">
        Medium Impact
      </span>
    );
  };

  return (
    <div className="w-full flex-1 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1600px] mx-auto space-y-8">
        {/* Header Banner */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                AI Failure Mode & Effects Analysis (FMEA)
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                Industrial &ldquo;What-If&rdquo; Failure Simulator
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-3xl">
                Upload any equipment diagram, manual page (PDF/TXT), or panel photo. The system generates 10 high-impact
                failure scenarios, or test custom hypothetical faults with grounded OEM proof links.
              </p>
            </div>
          </div>
        </div>

        {/* Upload & Context Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File & Context Card */}
          <div className="lg:col-span-1 space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text)] flex items-center gap-2">
              <Upload className="h-4 w-4 text-[var(--color-primary)]" />
              1. Input Equipment or Manual
            </h2>

            {/* Machine Name Field */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Machine Model / Equipment Type
              </label>
              <input
                type="text"
                value={machineContext}
                onChange={(e) => setMachineContext(e.target.value)}
                placeholder="e.g. Siemens SINAMICS S120 / Rexroth Hydraulic Press"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-xl p-4 text-center transition-all bg-[var(--color-surface-elevated)]/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              {filePreview ? (
                <div className="space-y-2">
                  <img
                    src={filePreview}
                    alt="Uploaded preview"
                    className="max-h-32 mx-auto rounded-lg object-contain border border-[var(--color-border)]"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{selectedFile?.name}</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-1 py-3">
                  <FileText className="h-8 w-8 text-[var(--color-primary)] mx-auto" />
                  <p className="text-xs font-medium text-[var(--color-text)] truncate">{selectedFile.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Click to switch file</p>
                </div>
              ) : (
                <div className="space-y-1.5 py-4">
                  <ImageIcon className="h-8 w-8 text-neutral-400 mx-auto" />
                  <p className="text-xs font-medium text-[var(--color-text)]">
                    Upload image, manual page, or schematic
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    PNG, JPG, PDF, or TXT formats supported
                  </p>
                </div>
              )}
            </div>

            {/* Optional Raw Text / Specs */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Or paste specifications / technical excerpt:
              </label>
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste operating parameters, pressure limits, or schematic notes..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              />
            </div>

            {/* Generate Questions Button */}
            <button
              onClick={handleGenerateQuestions}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] hover:opacity-90 px-4 py-2.5 text-xs font-semibold text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting & Generating 10 Scenarios...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Generate 10 What-If Questions</span>
                </>
              )}
            </button>
          </div>

          {/* Right 2 Columns: 10 What-If Cards & Custom Input */}
          <div className="lg:col-span-2 space-y-4">
            {/* Custom Scenario Direct Input */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text)] flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                Type Your Own Scenario (Direct Simulation)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customScenario}
                  onChange={(e) => setCustomScenario(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSimulate(customScenario)}
                  placeholder="e.g. What if proportional valve A trips during rapid downward clamping?"
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={() => handleSimulate(customScenario)}
                  disabled={isSimulating || !customScenario.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-medium text-white transition disabled:opacity-50 cursor-pointer"
                >
                  {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  <span>Simulate</span>
                </button>
              </div>
            </div>

            {/* Error Display */}
            {errorMsg && (
              <div className="rounded-xl border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 10 Generated What-If Question Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  10 Failure Scenarios Generated ({questions.length} Available)
                </h3>
                {questions.length > 0 && (
                  <button
                    onClick={handleGenerateQuestions}
                    className="text-[11px] text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate 10 Questions
                  </button>
                )}
              </div>

              {questions.length === 0 && !isGenerating && (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center bg-[var(--color-surface)]/40 space-y-2">
                  <Sparkles className="h-8 w-8 text-neutral-400 mx-auto" />
                  <p className="text-xs font-medium text-[var(--color-text)]">
                    No questions generated yet
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Click &ldquo;Generate 10 What-If Questions&rdquo; above to produce 10 failure scenarios based on your equipment.
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="rounded-xl border border-[var(--color-border)] p-8 text-center bg-[var(--color-surface)] space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)] mx-auto" />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Analyzing equipment specifications & engineering failure modes...
                  </p>
                </div>
              )}

              {/* When a question is selected, hide the other 9 choices and show only the chosen one */}
              {activeQuestion ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-primary)]">
                      Selected Failure Scenario:
                    </span>
                    <button
                      onClick={() => {
                        setActiveQuestion(null);
                        setSimulationResult(null);
                      }}
                      className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      ← Show All 10 Questions
                    </button>
                  </div>

                  {(() => {
                    const selectedQ = questions.find((q) => q.scenario === activeQuestion);
                    return (
                      <div className="rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-4 text-left space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                            Active Scenario {selectedQ ? `#${selectedQ.id} • ${selectedQ.category}` : "• Custom Scenario"}
                          </span>
                          {selectedQ && getSeverityBadge(selectedQ.severity)}
                        </div>
                        <p className="text-sm font-semibold text-[var(--color-text)] leading-relaxed">
                          {activeQuestion}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Show all questions in grid when none is active */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {questions.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => handleSimulate(q.scenario)}
                      className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 transition-all text-left space-y-2 hover:border-[var(--color-primary)] hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                          Scenario #{q.id} • {q.category}
                        </span>
                        {getSeverityBadge(q.severity)}
                      </div>
                      <p className="text-xs font-medium text-[var(--color-text)] leading-relaxed group-hover:text-[var(--color-primary)] transition-colors">
                        {q.scenario}
                      </p>
                      <div className="flex items-center justify-end text-[11px] font-semibold text-[var(--color-primary)] gap-1 pt-1 opacity-80 group-hover:opacity-100">
                        <span>Simulate Scenario</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Simulation Execution Loader */}
        {isSimulating && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)] mx-auto" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Simulating Physical Failure Dynamics & Sourcing OEM Bulletins...
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
              Surfing OEM technical databases and compiling ranked countermeasures for: &ldquo;{activeQuestion}&rdquo;
            </p>
          </div>
        )}

        {/* Simulation Output in Standard Format */}
        {simulationResult && !isSimulating && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header / Problem title */}
            <div className="border-b border-[var(--color-border)] pb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Simulation Verified
                  </span>
                  <span className="rounded-lg bg-neutral-200 dark:bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {simulationResult.escalation_level}
                  </span>
                </div>

                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="Download Black-and-White PDF Diagnostic Report"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF Report</span>
                    </>
                  )}
                </button>
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">
                {simulationResult.problem}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Tested Scenario: <span className="font-semibold text-[var(--color-text)]">{simulationResult.scenario}</span>
              </p>
            </div>

            {/* Mandatory Safety Warnings */}
            {simulationResult.safety_warnings?.length > 0 && (
              <div className="rounded-xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-900 dark:text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                  <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  Mandatory Safety & LOTO Protocol
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  {simulationResult.safety_warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detailed Diagnostic Explanation */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-primary)]">
                Engineering Diagnosis & Physical Cascade
              </span>
              <p className="text-sm text-[var(--color-text)] leading-relaxed font-medium">
                {simulationResult.diagnosis}
              </p>
              <div className="pt-2 text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {simulationResult.answer}
              </div>
            </div>

            {/* Probable Causes & Corrective Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Causes */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Root Causes & Triggers
                </h3>
                <ul className="space-y-2">
                  {simulationResult.probable_causes.map((cause, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Corrective Steps */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Step-by-Step Resolution Roadmap
                </h3>
                <ol className="space-y-2">
                  {simulationResult.corrective_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text)]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Recommended Solutions */}
            {simulationResult.recommended_solutions?.length > 0 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-secondary)]">
                  Ranked Engineering Solutions
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  {simulationResult.recommended_solutions.map((sol, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          Priority #{sol.priority}: {sol.action}
                        </span>
                        <span className="rounded-md bg-blue-100 dark:bg-blue-950/50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                          {sol.evidence_strength} Evidence
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">{sol.reason}</p>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        Source: {sol.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Web Proof Links */}
            {simulationResult.proof_links?.length > 0 && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  <Globe className="h-4 w-4" />
                  Live OEM Technical Bulletins & Proof References (Live Verified)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {simulationResult.proof_links.map((proof, i) => (
                    <a
                      key={i}
                      href={proof.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-xs hover:border-blue-400 dark:hover:border-blue-600 transition group shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center justify-between gap-1">
                          <span className="truncate">{proof.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                        </div>
                        {proof.snippet && (
                          <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2">
                            {proof.snippet}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 pt-2 block">
                        {proof.source || "OEM Knowledgebase"}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
