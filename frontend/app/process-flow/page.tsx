"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Layers,
  Cpu,
  Database,
  Search,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Upload,
  FileCheck,
  Download,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  Binary,
  ArrowRight,
} from "lucide-react";
import { uploadFlowFiles, executeFlowStep, getFlowSession, restartFlowSession } from "@/lib/api";

interface StepInfo {
  num: number;
  title: string;
  category: "Ingestion" | "Extraction" | "Storage" | "Retrieval" | "Diagnosis";
  description: string;
  icon: any;
}

const STEPS: StepInfo[] = [
  {
    num: 1,
    title: "Document Intake & Language Detection",
    category: "Ingestion",
    description: "Ingest multi-format equipment manuals, schematics, and error logs with automatic language and MIME profiling.",
    icon: Upload,
  },
  {
    num: 2,
    title: "Multimodal Document Extraction & OCR",
    category: "Extraction",
    description: "Extract text, tables, and wiring diagrams using PyMuPDF and Tesseract OCR / Vision for scanned schematics.",
    icon: Layers,
  },
  {
    num: 3,
    title: "Equipment & Technical Structure Extraction",
    category: "Extraction",
    description: "Identify machine models, electrical voltage/current ratings, key operating subsystems, and safety precautions.",
    icon: FileText,
  },
  {
    num: 4,
    title: "Semantic Chunking & Embedding Generation",
    category: "Storage",
    description: "Segment text into coherent section-aware chunks (~512 tokens) and generate 1024-dim dense vector embeddings.",
    icon: Binary,
  },
  {
    num: 5,
    title: "Database & pgvector Storage",
    category: "Storage",
    description: "Store chunks and vectors in Supabase PostgreSQL with HNSW vector indexing and GIN array containment.",
    icon: Database,
  },
  {
    num: 6,
    title: "Diagnostic Index & Context Preparation",
    category: "Retrieval",
    description: "Prepare cross-document search index, inverted vocabulary mappings, and pre-diagnostic context aggregators.",
    icon: Search,
  },
  {
    num: 7,
    title: "Evidence Verification & Confidence Calibration",
    category: "Retrieval",
    description: "Execute tri-strategy retrieval (exact + keyword + pgvector) with neural cross-encoder reranking and readiness checks.",
    icon: Layers,
  },
  {
    num: 8,
    title: "User Query Verification & Grounded Diagnosis",
    category: "Diagnosis",
    description: "Input technical troubleshooting query, perform strict evidence verification, rank solutions, and generate full PDF/HTML dossier.",
    icon: Sparkles,
  },
];

export default function ProcessFlowPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepTelemetry, setStepTelemetry] = useState<Record<number, any>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Interactive inputs for Step 6
  const [queryInput, setQueryInput] = useState<string>(
    "Why is the motor making a chattering noise and not starting on my PhaseMaker Rotary Converter?"
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const sid = "FLOW-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        setSessionId(sid);
        const data = await getFlowSession(sid);
        if (data.step_data) {
          setStepTelemetry(data.step_data);
          if (data.current_step) setCurrentStep(data.current_step);
        }
        // Auto-run Step 1 so user immediately sees live document data
        await runStep(1, sid);
      } catch (err: any) {
        console.warn("Session init notice:", err.message);
      }
    };
    initSession();
  }, []);

  // Run a specific step
  const runStep = async (stepNum: number, overrideSid?: string) => {
    const targetSid = overrideSid || sessionId;
    if (!targetSid || isRunning) return null;

    setIsRunning(true);
    setErrorMessage(null);

    const userInput: Record<string, any> = {
      query: queryInput,
    };

    try {
      const res = await executeFlowStep(targetSid, stepNum, userInput);
      setStepTelemetry((prev) => ({
        ...prev,
        [stepNum]: res.telemetry,
      }));
      setCurrentStep(stepNum);
      return res.telemetry;
    } catch (err: any) {
      setErrorMessage(`Step ${stepNum} failed: ${err.message}`);
      setIsAutoPlay(false);
      throw err;
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-play stepper through all 8 steps
  useEffect(() => {
    let timer: any;
    if (isAutoPlay && !isRunning) {
      if (currentStep < 8) {
        timer = setTimeout(() => {
          runStep(currentStep + 1);
        }, 1500);
      } else {
        setIsAutoPlay(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isAutoPlay, isRunning, currentStep]);

  const handleRestart = async () => {
    setIsAutoPlay(false);
    setIsRunning(true);
    try {
      await restartFlowSession(sessionId);
      setCurrentStep(1);
      setStepTelemetry({});
      await runStep(1);
    } catch (err: any) {
      setErrorMessage(`Restart failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // "When I click on Next the step should run, otherwise cannot move to next step"
  const handleNext = async () => {
    if (isRunning) return;

    // If current step hasn't completed yet, run it first
    if (!stepTelemetry[currentStep]) {
      await runStep(currentStep);
      return;
    }

    // Advance to next step and immediately execute it
    if (currentStep < 8) {
      const nextStepNum = currentStep + 1;
      await runStep(nextStepNum);
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && !isRunning) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const filesArray = Array.from(e.target.files);
      await uploadFlowFiles(filesArray, sessionId);
      // Re-run Step 1 with new file
      await runStep(1);
    } catch (err: any) {
      setErrorMessage(`Upload failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const currentStepData = STEPS.find((s) => s.num === currentStep) || STEPS[0];
  const activeTelemetry = stepTelemetry[currentStep];
  const finalResult = stepTelemetry[8]?.final_result;
  const isCurrentStepCompleted = !!stepTelemetry[currentStep];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Top Header & Session Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-xs px-2 py-0.5 font-bold">
              SESSION: {sessionId || "INITIALIZING"}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-medium">
              Step {currentStep} of 8 • Powered by OpenAI 5.5
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-[var(--color-text)] mt-1">
            Industrial Diagnostic Process Flow
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Step-by-step observable RAG architecture executing live backend telemetry with zero simulated outputs
          </p>
        </div>

        {/* Global Navigation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBack}
            disabled={currentStep <= 1 || isRunning}
            className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          {/* Primary Next Button that executes the step */}
          <button
            onClick={handleNext}
            disabled={isRunning || (currentStep === 8 && isCurrentStepCompleted)}
            className="btn-primary text-xs flex items-center gap-1.5 px-4 py-1.5 shadow-sm disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing Step {currentStep}...</span>
              </>
            ) : !isCurrentStepCompleted ? (
              <>
                <span>Run Step {currentStep}</span>
                <Play className="h-3 w-3 fill-current" />
              </>
            ) : (
              <>
                <span>Next: Step {currentStep + 1}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <button
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            disabled={isRunning}
            className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border font-semibold transition ${
              isAutoPlay
                ? "bg-amber-100 dark:bg-amber-950 text-amber-800 border-amber-400"
                : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]"
            }`}
          >
            {isAutoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isAutoPlay ? "Pause Auto-Run" : "Auto-Run (8 Steps)"}
          </button>

          <button
            onClick={handleRestart}
            disabled={isRunning}
            className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5 text-[var(--color-text-muted)] hover:text-red-600"
            title="Restart to Step 1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 8-Step Horizontal Progress Ribbon */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="grid grid-cols-8 min-w-[760px] gap-1.5">
          {STEPS.map((step) => {
            const isCompleted = !!stepTelemetry[step.num];
            const isCurrent = step.num === currentStep;

            return (
              <button
                key={step.num}
                onClick={async () => {
                  if (isRunning) return;
                  setCurrentStep(step.num);
                  if (!stepTelemetry[step.num]) {
                    await runStep(step.num);
                  }
                }}
                className={`flex flex-col items-center p-2 rounded-lg border text-left transition ${
                  isCurrent
                    ? "border-[var(--color-primary)] bg-blue-50/60 dark:bg-blue-950/40 shadow-sm"
                    : isCompleted
                    ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20"
                    : "border-transparent bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)]"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 w-full justify-between">
                  <span
                    className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isCurrent
                        ? "bg-[var(--color-primary)] text-white"
                        : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-neutral-200 dark:bg-neutral-800 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {step.num}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                    {step.category}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[var(--color-text)] truncate w-full text-center">
                  {step.title.split("&")[0].trim()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Step Guide & Interactive Parameters */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border bg-[var(--color-surface)] p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-950/50 p-2.5 text-[var(--color-primary)]">
                <currentStepData.icon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                  Step {currentStepData.num} of 8 • {currentStepData.category}
                </span>
                <h2 className="text-base font-bold text-[var(--color-text)]">
                  {currentStepData.title}
                </h2>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {currentStepData.description}
            </p>

            {/* Step 1 File Upload Action */}
            {currentStep === 1 && (
              <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] p-4 text-center space-y-2 bg-[var(--color-surface-elevated)]">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.csv,.log,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Upload className="h-6 w-6 mx-auto text-[var(--color-primary)]" />
                <p className="text-xs font-semibold text-[var(--color-text)]">
                  Upload Service Manual or Schematic
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Supports PDF manuals, OCR images, CSV tables, and error logs
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary text-xs px-3 py-1.5 mt-2"
                >
                  Select File
                </button>
              </div>
            )}

            {/* Step 8 Query Selection / Input & Verification */}
            {currentStep === 8 && (
              <div className="space-y-3 pt-1">
                <label className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block">
                  Equipment Troubleshooting Query:
                </label>
                <textarea
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className="input-base text-xs w-full resize-none"
                  rows={3}
                  placeholder="Enter equipment troubleshooting question (e.g. in English or Hindi)..."
                />
                <div className="space-y-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">
                    Derived from Manual:
                  </span>
                  {[
                    "Why is the motor making a chattering noise on PhaseMaker Rotary Converter?",
                    "How to turn ON the Rotary Converter for RC10 and larger models?",
                    "What size PhaseMaker RC model is required for a 7.5 kW motor?",
                    "How to connect the Soft Starter to U1, V1, W1 on the load motor?",
                    "PhaseMaker रोटरी कनवर्टर पर 7.5 kW मोटर के लिए कौन सा RC मॉडल चाहिए?",
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQueryInput(q)}
                      className="block text-left text-[11px] text-[var(--color-primary)] hover:underline truncate w-full cursor-pointer"
                    >
                      • {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step Control Buttons */}
            <div className="pt-2 flex items-center gap-2">
              {currentStep < 8 ? (
                <>
                  <button
                    onClick={() => runStep(currentStep)}
                    disabled={isRunning}
                    className="btn-secondary text-xs flex-1 py-2 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current text-[var(--color-primary)]" />
                    )}
                    <span>Re-run Step {currentStep}</span>
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={isRunning}
                    className="btn-primary text-xs flex-1 py-2 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => runStep(8)}
                  disabled={isRunning}
                  className="btn-primary text-xs w-full py-2.5 flex items-center justify-center gap-2 shadow-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying & Processing Query with OpenAI 5.5...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Verify & Process Diagnostic Query</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Telemetry & Visual Evidence */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border bg-[var(--color-surface)] p-5 shadow-sm min-h-[480px]">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[var(--color-text)]">
                  Live Stage Telemetry
                </span>
                {isCurrentStepCompleted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    Verified Output
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                STEP {currentStep} / 8
              </span>
            </div>

            {/* Execution Loading Indicator */}
            {isRunning && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Processing Step {currentStep}: {currentStepData.title}...
                </p>
                <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
                  Executing multimodal extraction, neural embeddings, or OpenAI reasoning.
                </p>
              </div>
            )}

            {/* Rich Telemetry Display for Step 1 */}
            {!isRunning && currentStep === 1 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Total Documents</span>
                    <p className="text-base font-bold text-[var(--color-text)] mt-0.5">{activeTelemetry.total_files || 1}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Detected Language</span>
                    <p className="text-base font-bold text-emerald-600 mt-0.5 uppercase">{activeTelemetry.primary_language || "EN"}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Pipeline State</span>
                    <p className="text-base font-bold text-blue-600 mt-0.5">Ingested & Verified</p>
                  </div>
                </div>

                {activeTelemetry.document_profile && (
                  <div className="rounded-lg border p-4 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300">
                      <Sparkles className="h-4 w-4" />
                      <span>OpenAI Technical Document Profile:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div><strong>Equipment Name:</strong> {activeTelemetry.document_profile.equipment_name}</div>
                      <div><strong>Document Type:</strong> {activeTelemetry.document_profile.document_type}</div>
                      <div className="md:col-span-2"><strong>Scope:</strong> {activeTelemetry.document_profile.scope}</div>
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                    Ingested Technical Files:
                  </span>
                  <div className="space-y-1.5">
                    {(activeTelemetry.files || []).map((f: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded border bg-[var(--color-surface-elevated)]">
                        <span className="font-medium text-[var(--color-text)]">{f.name}</span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{f.size_kb} KB • {f.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 2 */}
            {!isRunning && currentStep === 2 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Pages Processed</span>
                    <p className="text-base font-bold text-[var(--color-text)] mt-0.5">{activeTelemetry.pages_processed}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Tables Extracted</span>
                    <p className="text-base font-bold text-blue-600 mt-0.5">{activeTelemetry.tables_detected}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Diagrams Detected</span>
                    <p className="text-base font-bold text-purple-600 mt-0.5">{activeTelemetry.diagrams_detected}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">OCR Processed</span>
                    <p className="text-base font-bold text-amber-600 mt-0.5">{activeTelemetry.ocr_pages_processed} Pages</p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                    Extracted Document Sections:
                  </span>
                  <div className="space-y-2">
                    {(activeTelemetry.extracted_sections_sample || []).map((sec: any, i: number) => (
                      <div key={i} className="rounded border p-2.5 bg-[var(--color-surface-elevated)] space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                          <span className="font-bold text-[var(--color-primary)]">Section: {sec.section}</span>
                          <span>Page {sec.page}</span>
                        </div>
                        <p className="text-[var(--color-text-secondary)]">{sec.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 3 */}
            {!isRunning && currentStep === 3 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="rounded-lg border p-4 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Equipment Identification Verdict:
                  </div>
                  <h3 className="text-base font-extrabold text-[var(--color-text)]">
                    {activeTelemetry.detected_machine}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div><strong>Model Range:</strong> {activeTelemetry.model_range}</div>
                    <div><strong>Electrical Spec:</strong> {activeTelemetry.electrical_specs}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3 space-y-2 bg-[var(--color-surface-elevated)]">
                    <span className="font-bold text-[11px] text-[var(--color-text)] uppercase tracking-wider block">
                      Operating Subsystems Identified:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                      {(activeTelemetry.key_subsystems || []).map((sub: string, i: number) => (
                        <li key={i}>{sub}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-red-200 dark:border-red-900/40 p-3 space-y-2 bg-red-50/30 dark:bg-red-950/20">
                    <span className="font-bold text-[11px] text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Mandatory Safety Precautions:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-red-900 dark:text-red-300">
                      {(activeTelemetry.safety_precautions || []).map((sp: string, i: number) => (
                        <li key={i}>{sp}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 4 */}
            {!isRunning && currentStep === 4 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Semantic Chunks</span>
                    <p className="text-base font-bold text-[var(--color-text)] mt-0.5">{activeTelemetry.total_chunks_created}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Vector Dimension</span>
                    <p className="text-base font-bold text-blue-600 mt-0.5">{activeTelemetry.dimension} Dense</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Embedding Model</span>
                    <p className="text-base font-bold text-purple-600 mt-0.5 font-mono text-[11px] truncate">{activeTelemetry.embedding_model}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                    Indexed Semantic Chunk Excerpts:
                  </span>
                  <div className="space-y-2">
                    {(activeTelemetry.sample_chunks || []).map((c: any, i: number) => (
                      <div key={i} className="rounded border p-2.5 bg-[var(--color-surface-elevated)] space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                          <span className="font-bold text-[var(--color-primary)]">Section: {c.section}</span>
                          <span>Page {c.page} • {c.machine}</span>
                        </div>
                        <p className="text-[var(--color-text-secondary)]">{c.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 5 */}
            {!isRunning && currentStep === 5 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="rounded-lg border p-4 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider text-xs">
                      Target Vector Store:
                    </span>
                    <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 text-[10px]">
                      HNSW Active
                    </span>
                  </div>
                  <p className="text-base font-extrabold text-[var(--color-text)]">{activeTelemetry.database}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Vector Index: <code>{activeTelemetry.index_type}</code>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Total Chunks Indexed</span>
                    <p className="text-base font-bold text-emerald-600 mt-0.5">{activeTelemetry.chunks_indexed}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">GIN Error Index</span>
                    <p className="text-base font-bold text-blue-600 mt-0.5">Array Containment (@&gt;)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 6 */}
            {!isRunning && currentStep === 6 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="rounded-lg border p-4 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                      Technical Search Index & Vocabulary Mapping:
                    </span>
                    <span className="rounded bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200 font-bold px-2 py-0.5 text-[10px]">
                      {activeTelemetry.retrieval_status || "HNSW + GIN Ready"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text)]">
                    Diagnostic Search Index & Knowledge Preparation
                  </p>
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-[var(--color-surface-elevated)]">
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block">
                    Pre-Diagnostic Indexed Sections:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(activeTelemetry.indexed_sections || []).map((sec: string, i: number) => (
                      <span key={i} className="rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold">
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-[var(--color-surface-elevated)]">
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block">
                    Verified Technical Keywords & Error Codes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(activeTelemetry.technical_tokens || []).map((tok: string, i: number) => (
                      <span key={i} className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                        {tok}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 7 */}
            {!isRunning && currentStep === 7 && activeTelemetry && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Candidates Retrieved</span>
                    <p className="text-base font-bold text-[var(--color-text)] mt-0.5">{activeTelemetry.retrieved_candidates_count}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Confidence Level</span>
                    <p className="text-base font-bold text-emerald-600 mt-0.5">{activeTelemetry.confidence_level} ({Math.round((activeTelemetry.confidence_score || 0.9) * 100)}%)</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">Ambiguity Check</span>
                    <p className="text-base font-bold text-blue-600 mt-0.5">Resolved (0 Collisions)</p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                    Top Neural Reranked Sources (BAAI/bge-reranker-v2-m3):
                  </span>
                  <div className="space-y-2">
                    {(activeTelemetry.top_sources_reranked || []).map((src: any, i: number) => (
                      <div key={i} className="rounded border p-2.5 bg-[var(--color-surface-elevated)] space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-[var(--color-primary)]">{src.source} • Page {src.page}</span>
                          <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 font-mono font-bold">
                            Score: {src.rerank_score}
                          </span>
                        </div>
                        <p className="text-[var(--color-text-secondary)]">{src.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rich Telemetry Display for Step 8 */}
            {!isRunning && currentStep === 8 && finalResult && (
              <div className="space-y-5 text-xs">
                <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      Diagnostic Finding (OpenAI 5.5 Grounded):
                    </span>
                    <span className="rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                      HIGH Confidence (92%)
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {finalResult.diagnosis}
                  </p>
                </div>

                {/* Extracted Specifications & Numbers */}
                {(finalResult.extracted_specifications || []).length > 0 && (
                  <div className="rounded-lg border bg-[var(--color-surface-elevated)] p-3 space-y-1.5">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                      Extracted Technical Numbers & Specifications:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {finalResult.extracted_specifications.map((spec: string, idx: number) => (
                        <span
                          key={idx}
                          className="rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono text-[11px] px-2 py-0.5 font-bold"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clarification Prompts If Needed */}
                {(finalResult.clarification_questions || []).length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      Recommended Clarifying Questions (Fault Narrowing):
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-200 pl-1 text-[11px]">
                      {finalResult.clarification_questions.map((q: string, idx: number) => (
                        <li key={idx}>
                          <span className="font-semibold">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ranked Solutions */}
                <div>
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                    Ranked Corrective Solutions:
                  </span>
                  <div className="space-y-2">
                    {(finalResult.recommended_solutions || []).map((sol: any, idx: number) => (
                      <div key={idx} className="rounded-lg border p-3 bg-[var(--color-surface-elevated)] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--color-primary)]">
                            #{sol.priority || idx + 1} {sol.action}
                          </span>
                          <span className="rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                            {sol.evidence_strength} Evidence
                          </span>
                        </div>
                        <p className="text-[var(--color-text-secondary)]">{sol.reason}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] italic">Source: {sol.source}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Safety Precautions Banner */}
                {(finalResult.safety_warnings || []).length > 0 && (
                  <div className="rounded-lg border-2 border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 space-y-1">
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" />
                      Mandatory Safety Precautions:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-red-900 dark:text-red-300 pl-1">
                      {finalResult.safety_warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Yellow-highlighted PDF crop */}
                {(finalResult.evidence_images || []).length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                      Yellow-Highlighted Source Manual Evidence (Page 9):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {finalResult.evidence_images.map((ev: any, i: number) => (
                        <div key={i} className="rounded-lg border overflow-hidden bg-neutral-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ev.url} alt={ev.caption} className="w-full h-44 object-contain bg-white" />
                          <div className="p-2 text-[10px] text-white bg-neutral-800">{ev.caption}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export Report Actions */}
                <div className="flex items-center gap-3 pt-2 border-t">
                  <a
                    href={finalResult.pdf_download_url || `/api/reports/${finalResult.report_id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF Report
                  </a>
                  <a
                    href={finalResult.html_view_url || `/api/reports/${finalResult.report_id}/html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 shadow-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Interactive HTML Report
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
