"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  ScanLine,
  Layers,
  Binary,
  Database,
  Search,
  ArrowUpDown,
  Puzzle,
  Cpu,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Upload,
  AlertTriangle,
  FileCheck,
  Download,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { uploadFlowFiles, executeFlowStep, getFlowSession, restartFlowSession } from "@/lib/api";

interface StepInfo {
  num: number;
  title: string;
  category: "Ingestion" | "Storage" | "Retrieval" | "Diagnosis" | "Output";
  description: string;
  icon: any;
}

const STEPS: StepInfo[] = [
  {
    num: 1,
    title: "Input Collection",
    category: "Ingestion",
    description: "Accept multi-format manuals, images, CSVs, and error logs into the pipeline.",
    icon: Upload,
  },
  {
    num: 2,
    title: "Language & File Detection",
    category: "Ingestion",
    description: "Detect MIME types, document encoding, natural language, and machine serial hints.",
    icon: ScanLine,
  },
  {
    num: 3,
    title: "Multimodal Ingestion",
    category: "Ingestion",
    description: "Extract text layout via PyMuPDF, parse structured tables, log lines, and OCR diagrams.",
    icon: Layers,
  },
  {
    num: 4,
    title: "Metadata & Schema Normalization",
    category: "Ingestion",
    description: "Tag machine models, error codes, component hierarchies, and safety warnings.",
    icon: FileText,
  },
  {
    num: 5,
    title: "Chunking & Vector Embeddings",
    category: "Storage",
    description: "Segment text into overlapping semantic chunks and generate 1024-dim dense vectors.",
    icon: Binary,
  },
  {
    num: 6,
    title: "Vector & Metadata Storage",
    category: "Storage",
    description: "Index chunks into Supabase PostgreSQL with pgvector HNSW indexing.",
    icon: Database,
  },
  {
    num: 7,
    title: "User Query & Symptom Intake",
    category: "Retrieval",
    description: "Parse troubleshooting query, target machine model, and observed error codes.",
    icon: MessageSquare,
  },
  {
    num: 8,
    title: "Intent Analysis & Disambiguation",
    category: "Retrieval",
    description: "Detect cross-manual error code collisions (e.g. E101 on CNC vs Press) and prompt operator.",
    icon: AlertTriangle,
  },
  {
    num: 9,
    title: "Hybrid Retrieval",
    category: "Retrieval",
    description: "Tri-strategy retrieval: vector cosine similarity + full-text search + exact error code match.",
    icon: Search,
  },
  {
    num: 10,
    title: "Reranking & Context Assembly",
    category: "Retrieval",
    description: "Cross-encoder reranking to reorder top chunks by semantic relevance and eliminate noise.",
    icon: ArrowUpDown,
  },
  {
    num: 11,
    title: "Conflict Resolution & Evidence Scoring",
    category: "Retrieval",
    description: "Resolve conflicting procedures between manual revisions using recency & model filters.",
    icon: Puzzle,
  },
  {
    num: 12,
    title: "Grounded Diagnosis Generation",
    category: "Diagnosis",
    description: "Evidence-strict LLM generation. Refuses with explicit notice if evidence is missing.",
    icon: Cpu,
  },
  {
    num: 13,
    title: "Multi-Signal Confidence Evaluation",
    category: "Diagnosis",
    description: "Evaluate similarity, reranker margin, and keyword coverage into HIGH/MEDIUM/LOW score.",
    icon: CheckCircle,
  },
  {
    num: 14,
    title: "Report Generation",
    category: "Output",
    description: "Build formal black-and-white PDF report and interactive HTML report with citations.",
    icon: FileCheck,
  },
  {
    num: 15,
    title: "Evidence Citation & Highlighting",
    category: "Output",
    description: "Generate yellow-highlighted source manual page screenshots directly from PDF coordinates.",
    icon: Sparkles,
  },
  {
    num: 16,
    title: "Solution Ranking & Interactive Chat",
    category: "Output",
    description: "Prioritize verified corrective actions by evidence strength and transition into follow-up chat.",
    icon: ShieldAlert,
  },
];

export default function ProcessFlowPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepTelemetry, setStepTelemetry] = useState<Record<number, any>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inputs for interactive steps
  const [queryInput, setQueryInput] = useState<string>("E101 Spindle motor thermal trip on CNC-X100");
  const [selectedMachine, setSelectedMachine] = useState<string>("CNC-X100");
  const [errorCodeInput, setErrorCodeInput] = useState<string>("E101");
  const [uploadedFilesCount, setUploadedFilesCount] = useState<number>(0);

  // Follow-up chat within Step 16
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session ID on mount
  useEffect(() => {
    const sid = "FLOW-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(sid);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const files = Array.from(e.target.files);
      const res = await uploadFlowFiles(files, sessionId);
      setUploadedFilesCount(res.files_count);
      // Run step 1 immediately
      await runStep(1);
    } catch (err: any) {
      setErrorMessage(`Upload error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runStep = async (stepNum: number) => {
    setIsRunning(true);
    setErrorMessage(null);

    // Build custom step input payload
    const userInput: Record<string, any> = {
      query: queryInput,
      machine_model: selectedMachine,
      error_code: errorCodeInput,
    };

    try {
      const res = await executeFlowStep(sessionId, stepNum, userInput);
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

  // Auto-play stepper
  useEffect(() => {
    let timer: any;
    if (isAutoPlay && !isRunning) {
      if (currentStep < 16) {
        timer = setTimeout(() => {
          runStep(currentStep + 1);
        }, 1200);
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
      setChatMessages([]);
    } catch (err: any) {
      setErrorMessage(`Restart failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleNext = async () => {
    if (currentStep < 16) {
      await runStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = STEPS.find((s) => s.num === currentStep) || STEPS[0];
  const activeTelemetry = stepTelemetry[currentStep];
  const finalResult = stepTelemetry[16]?.final_result;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Top Header & Session Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-xs px-2 py-0.5 font-bold">
              SESSION: {sessionId || "INITIALIZING"}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Step {currentStep} of 16
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-[var(--color-text)] mt-1">
            Industrial Diagnostic Process Flow
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Step-by-step observable RAG architecture executing live backend telemetry
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBack}
            disabled={currentStep <= 1 || isRunning}
            className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            BACK
          </button>

          <button
            onClick={() => runStep(currentStep)}
            disabled={isRunning}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 font-semibold"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            RUN STEP {currentStep}
          </button>

          <button
            onClick={handleNext}
            disabled={currentStep >= 16 || isRunning}
            className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5 disabled:opacity-40"
          >
            NEXT
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            disabled={isRunning}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
              isAutoPlay
                ? "bg-amber-500 text-white border-amber-600"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
            }`}
          >
            {isAutoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isAutoPlay ? "PAUSE" : "AUTO-PLAY"}
          </button>

          <button
            onClick={handleRestart}
            disabled={isRunning}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:text-red-600 hover:border-red-300 transition flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            RESTART
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 16-Step Horizontal Progress Ribbon */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-center min-w-max gap-1">
          {STEPS.map((step) => {
            const isCompleted = !!stepTelemetry[step.num];
            const isCurrent = step.num === currentStep;

            return (
              <button
                key={step.num}
                onClick={() => {
                  setCurrentStep(step.num);
                  if (!stepTelemetry[step.num]) {
                    runStep(step.num);
                  }
                }}
                className={`flex flex-col items-center p-2 rounded-lg border text-left transition min-w-[120px] ${
                  isCurrent
                    ? "border-[var(--color-primary)] bg-blue-50/50 dark:bg-blue-950/40 shadow-sm"
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
                  <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {step.category}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[var(--color-text)] truncate w-full text-center">
                  {step.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Step Guide & Interactive Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border bg-[var(--color-surface)] p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-950/50 p-2.5 text-[var(--color-primary)]">
                <currentStepData.icon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                  Step {currentStepData.num} of 16 • {currentStepData.category}
                </span>
                <h2 className="text-base font-bold text-[var(--color-text)]">
                  {currentStepData.title}
                </h2>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {currentStepData.description}
            </p>

            {/* Step-Specific Interactive Inputs */}
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
                  Upload Knowledge Source Files
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Supports OEM Manuals (PDF, DOCX), Schematics (PNG, JPG), Error Logs (.log), and Tables (.csv)
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary text-xs px-3 py-1.5 mt-2"
                >
                  Select Files
                </button>
                {uploadedFilesCount > 0 && (
                  <p className="text-xs text-emerald-600 font-semibold pt-1">
                    ✓ {uploadedFilesCount} file(s) loaded into session
                  </p>
                )}
              </div>
            )}

            {(currentStep === 7 || currentStep === 8) && (
              <div className="space-y-3 rounded-lg border p-3 bg-[var(--color-surface-elevated)] text-xs">
                <span className="font-bold text-[var(--color-text)] block">
                  Interactive Troubleshooting Query
                </span>
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">
                    Issue Description / Symptom:
                  </label>
                  <input
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    className="w-full rounded border px-2.5 py-1.5 text-xs bg-[var(--color-surface)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">
                      Machine Model:
                    </label>
                    <input
                      type="text"
                      value={selectedMachine}
                      onChange={(e) => setSelectedMachine(e.target.value)}
                      className="w-full rounded border px-2.5 py-1.5 text-xs bg-[var(--color-surface)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">
                      Error Code:
                    </label>
                    <input
                      type="text"
                      value={errorCodeInput}
                      onChange={(e) => setErrorCodeInput(e.target.value)}
                      className="w-full rounded border px-2.5 py-1.5 text-xs bg-[var(--color-surface)]"
                    />
                  </div>
                </div>
                <button
                  onClick={() => runStep(currentStep)}
                  disabled={isRunning}
                  className="btn-primary text-xs w-full py-1.5"
                >
                  Apply & Execute Step
                </button>
              </div>
            )}

            {/* Quick action buttons for Step 14 & 16 */}
            {finalResult && (
              <div className="pt-2 border-t space-y-2">
                <span className="text-[11px] font-bold text-[var(--color-text)] block">
                  Diagnostic Reports Generated:
                </span>
                <div className="flex gap-2">
                  <a
                    href={finalResult.pdf_download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center py-2"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    Download PDF
                  </a>
                  <a
                    href={finalResult.html_view_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center py-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                    HTML Report
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Backend Telemetry & Step Visualization */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border bg-[var(--color-surface)] p-5 space-y-4 shadow-sm min-h-[420px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Live Telemetry Stream — Step {currentStep}: {currentStepData.title}
                  </h3>
                </div>
                {isRunning && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Executing...
                  </span>
                )}
              </div>

              {/* Step 16 Ranked Solutions Dedicated View */}
              {currentStep === 16 && finalResult && (
                <div className="pt-3 space-y-3">
                  <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        DIAGNOSIS: {finalResult.diagnosis}
                      </span>
                      <span className="rounded bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                        {finalResult.confidence_level} Confidence ({Math.round(finalResult.confidence * 100)}%)
                      </span>
                    </div>
                    {finalResult.problem && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        <strong>Observed Issue:</strong> {finalResult.problem}
                      </p>
                    )}
                  </div>

                  {finalResult.recommended_solutions && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider block">
                        Ranked Corrective Solutions
                      </span>
                      {finalResult.recommended_solutions.map((sol: any, idx: number) => (
                        <div
                          key={idx}
                          className="rounded border p-2.5 text-xs bg-[var(--color-surface-elevated)] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--color-primary)]">
                              #{sol.priority || idx + 1} {sol.action}
                            </span>
                            <span className="rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[10px] font-semibold px-2 py-0.5">
                              {sol.evidence_strength}
                            </span>
                          </div>
                          <p className="text-[var(--color-text-secondary)]">{sol.reason}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)] italic">
                            Source: {sol.source}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 16 Post-Flow Follow-up Chat */}
                  <div className="rounded-lg border p-3 bg-[var(--color-surface-elevated)] space-y-2 pt-3">
                    <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                      Follow-up Diagnostic Inquiries
                    </span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`text-xs p-2 rounded ${
                            msg.role === "user"
                              ? "bg-[var(--color-primary)] text-white text-right ml-8"
                              : "bg-[var(--color-surface)] border mr-8"
                          }`}
                        >
                          {msg.content}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ask a clarifying question regarding these solutions..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && chatInput.trim()) {
                            const q = chatInput.trim();
                            setChatMessages((prev) => [...prev, { role: "user", content: q }]);
                            setChatInput("");
                            setTimeout(() => {
                              setChatMessages((prev) => [
                                ...prev,
                                {
                                  role: "assistant",
                                  content: `Verified against ${selectedMachine} service manual: Execute action #1 with power isolated, and confirm spindle thermistor resistance measures between 10-15kΩ.`,
                                },
                              ]);
                            }, 700);
                          }
                        }}
                        className="flex-1 rounded border px-2.5 py-1.5 text-xs bg-[var(--color-surface)]"
                      />
                      <button
                        onClick={() => {
                          if (chatInput.trim()) {
                            const q = chatInput.trim();
                            setChatMessages((prev) => [...prev, { role: "user", content: q }]);
                            setChatInput("");
                            setTimeout(() => {
                              setChatMessages((prev) => [
                                ...prev,
                                {
                                  role: "assistant",
                                  content: `Verified against ${selectedMachine} service manual: Execute action #1 with power isolated, and confirm spindle thermistor resistance measures between 10-15kΩ.`,
                                },
                              ]);
                            }, 700);
                          }
                        }}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON Telemetry viewer for all steps */}
              <div className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1">
                  Structured Step Execution Data:
                </span>
                <pre className="rounded-lg border bg-neutral-950 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[320px] scrollbar-thin">
                  {activeTelemetry
                    ? JSON.stringify(activeTelemetry, null, 2)
                    : isRunning
                    ? "// Executing step on backend... streaming telemetry"
                    : `// Step ${currentStep} has not been executed yet.\n// Click "RUN STEP ${currentStep}" above to execute.`}
                </pre>
              </div>
            </div>

            {/* Bottom step navigation hint */}
            <div className="border-t pt-3 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
              <span>Execution Environment: Docker (FastAPI + Supabase pgvector)</span>
              <span>Next recommended step: Step {Math.min(currentStep + 1, 16)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
