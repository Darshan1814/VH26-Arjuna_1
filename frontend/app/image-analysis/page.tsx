/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Upload,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Zap,
  Globe,
  FileSearch,
  Maximize2,
  X,
  Sparkles,
  Download,
  Cpu,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { downloadDirectPDF } from "@/lib/api";

interface ImageAnalysisResult {
  ocr_text: string;
  detected_error_code?: string;
  detected_machine?: string;
  problem: string;
  diagnosis: string;
  answer: string;
  probable_causes: string[];
  corrective_steps: string[];
  recommended_solutions: {
    priority: number;
    action: string;
    reason: string;
    evidence_strength: string;
    source: string;
    is_verified: boolean;
  }[];
  safety_warnings: string[];
  confidence: number;
  proof_links: { title: string; link: string; snippet?: string; source?: string }[];
}

export default function ImageAnalysisPage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [machineHint, setMachineHint] = useState<string>("");
  const [symptoms, setSymptoms] = useState<string>("");

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg(null);
      setResult(null);

      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMsg("Please select or upload a panel/machine image first.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (machineHint.trim()) formData.append("machine_hint", machineHint.trim());
      if (symptoms.trim()) formData.append("symptoms", symptoms.trim());

      const res = await fetch("http://localhost:8000/api/vision/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Analysis failed: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to analyze machine image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    setIsDownloadingPdf(true);
    try {
      const payload = {
        query: `Image Analysis: ${result.problem}`,
        machine_model: result.detected_machine || machineHint || "Industrial Machine",
        error_code: result.detected_error_code || "PHOTO-DIAG",
        problem: result.problem,
        diagnosis: result.diagnosis,
        probable_causes: result.probable_causes,
        recommended_solutions: result.recommended_solutions,
        safety_warnings: result.safety_warnings,
        confidence_level: result.confidence >= 0.8 ? "HIGH" : "MEDIUM",
        confidence: result.confidence,
        proof_links: result.proof_links,
        report_id: `IMG_${Date.now().toString().slice(-6)}`,
      };
      await downloadDirectPDF(payload, `Image_Analysis_Report_${Date.now()}.pdf`);
    } catch (err: any) {
      console.error("Failed to download PDF:", err);
      setErrorMsg("Failed to download PDF report: " + (err.message || "Unknown error"));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="w-full flex-1 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 sm:p-8 shadow-sm">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Camera className="h-3.5 w-3.5" />
              Vision & Optical Character Recognition (OCR)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
              Image Analysis & Error Solving
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-3xl">
              Upload machine alarm screen photos, indicator panels, digital gauge readouts, or damaged components.
              High-precision OCR extracts alphanumeric fault codes, and the system synthesizes comprehensive troubleshooting
              guidance backed by verified web proof links.
            </p>
          </div>
        </div>

        {/* Upload & Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Image Upload & Inputs */}
          <div className="lg:col-span-1 space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text)] flex items-center gap-2">
              <Upload className="h-4 w-4 text-[var(--color-primary)]" />
              1. Upload Machine Image
            </h2>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-xl p-4 text-center transition-all bg-[var(--color-surface-elevated)]/50 relative group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Uploaded panel"
                    className="max-h-56 mx-auto rounded-lg object-contain border border-[var(--color-border)]"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 text-white text-xs font-medium">
                    <span>Click to change image</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsModalOpen(true);
                    }}
                    className="absolute top-2 right-2 rounded-md bg-black/70 p-1.5 text-white hover:bg-black"
                    title="Enlarge Image"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-6">
                  <Camera className="h-10 w-10 text-neutral-400 mx-auto" />
                  <p className="text-xs font-semibold text-[var(--color-text)]">
                    Drop or click to upload photo
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Panel screens, error codes, LED alarms, gauges (PNG, JPG, WebP)
                  </p>
                </div>
              )}
            </div>

            {/* Machine Hint */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Machine / Brand Hint (Optional)
              </label>
              <input
                type="text"
                value={machineHint}
                onChange={(e) => setMachineHint(e.target.value)}
                placeholder="e.g. Leave blank to auto-detect, or enter RoboArm-R5, CNC-X100..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* Symptoms Description */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Observed Physical Symptoms (Optional)
              </label>
              <textarea
                rows={3}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Motor tripped after 10 min continuous run, high temperature warning on axis 3..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              />
            </div>

            {/* Analyze Action Button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !selectedFile}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing OCR & Diagnosing Error...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Analyze Image & Solve Fault</span>
                </>
              )}
            </button>
          </div>

          {/* Right 2 Columns: Results or Placeholder */}
          <div className="lg:col-span-2 space-y-4">
            {/* Error Message */}
            {errorMsg && (
              <div className="rounded-xl border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Idle Placeholder */}
            {!result && !isAnalyzing && (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center bg-[var(--color-surface)]/50 space-y-3">
                <FileSearch className="h-10 w-10 text-neutral-400 mx-auto" />
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  Ready for Optical Character Recognition & Diagnosis
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
                  Upload an image on the left and click &ldquo;Analyze Image & Solve Fault&rdquo; to extract error codes and view
                  step-by-step resolution procedures.
                </p>
              </div>
            )}

            {/* Analysis Loading Screen */}
            {isAnalyzing && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  Running Tesseract OCR & Sourcing OEM Service Bulletins...
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
                  Scanning image for text, error codes, and telemetry values to synthesize official repair instructions.
                </p>
              </div>
            )}

            {/* Diagnostic Output */}
            {result && !isAnalyzing && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 space-y-6 shadow-sm">
                {/* Header Badge Row */}
                <div className="border-b border-[var(--color-border)] pb-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-3 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        OCR & AI Verified ({Math.round(result.confidence * 100)}%)
                      </span>
                      {result.detected_error_code && (
                        <span className="rounded-full bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-3 py-0.5 text-xs font-bold uppercase text-red-700 dark:text-red-400">
                          {result.detected_error_code}
                        </span>
                      )}
                      <span className="rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 px-3 py-0.5 text-xs font-bold text-[var(--color-primary)] flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5" />
                        Machine: {result.detected_machine}
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
                    {result.problem}
                  </h2>
                </div>

                {/* OCR Extracted Text Card */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1">
                    <FileSearch className="h-3.5 w-3.5 text-blue-500" />
                    OCR Extracted Text from Image
                  </span>
                  <pre className="text-xs font-mono bg-black/5 dark:bg-black/30 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap text-[var(--color-text)] border border-[var(--color-border)]/50">
                    {result.ocr_text || "[No legible text detected]"}
                  </pre>
                </div>

                {/* Safety Precautions */}
                {result.safety_warnings?.length > 0 && (
                  <div className="rounded-xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-900 dark:text-red-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                      <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                      Mandatory Lockout/Tagout (LOTO) & Electrical Safety
                    </div>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      {result.safety_warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnostic Findings */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                    Diagnostic Finding & Physical Root Mechanism
                  </span>
                  <p className="text-sm font-semibold text-[var(--color-text)] leading-relaxed">
                    {result.diagnosis}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed pt-1">
                    {result.answer}
                  </p>
                </div>

                {/* Causes and Corrective Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Likely Causes
                    </h3>
                    <ul className="space-y-2">
                      {result.probable_causes.map((cause, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Step-by-Step Resolution
                    </h3>
                    <ol className="space-y-2">
                      {result.corrective_steps.map((step, i) => (
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

                {/* Ranked Solutions */}
                {result.recommended_solutions?.length > 0 && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-secondary)]">
                      Ranked Countermeasures
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5">
                      {result.recommended_solutions.map((sol, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--color-text)]">
                              Priority #{sol.priority}: {sol.action}
                            </span>
                            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
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
                {result.proof_links?.length > 0 && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                      <Globe className="h-4 w-4" />
                      Live OEM Service Bulletins & Verified Proof Links
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {result.proof_links.map((proof, i) => (
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
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isModalOpen && imagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-neutral-900 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={imagePreview}
              alt="Machine Enlarge"
              className="max-h-[85vh] w-auto object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
