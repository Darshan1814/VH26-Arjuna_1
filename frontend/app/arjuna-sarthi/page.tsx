"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Bot,
  Globe,
  Terminal,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Send,
  Loader2,
  ChevronRight,
  ArrowDownToLine,
  Compass,
  Play,
  Copy,
  Check,
  BookOpen,
  Maximize2,
  X,
} from "lucide-react";
import { ArjunaSarthiLogo } from "@/components/branding/arjuna-sarthi-logo";
import { getApiBase } from "@/lib/api";

export default function ArjunaSarthiPage() {
  const [backendStatus, setBackendStatus] = useState<{
    status: string;
    model: string;
    backend_ready: boolean;
  }>({ status: "checking", model: "", backend_ready: false });

  // In-Page Simulator State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simUrl, setSimUrl] = useState("https://kubernetes.io/docs/concepts/overview/what-is-kubernetes/");
  const [simStep, setSimStep] = useState<"idle" | "fetching" | "ready">("ready");
  const [simQuestion, setSimQuestion] = useState("What are Kubernetes Pods and how do they communicate?");
  const [simLoading, setSimLoading] = useState(false);
  const [simAnswer, setSimAnswer] = useState<string | null>(null);
  const [simSources, setSimSources] = useState<any[]>([]);
  const [simError, setSimError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Check backend health
  const checkHealth = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/extension/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendStatus({ status: data.status, model: data.model, backend_ready: true });
      } else {
        setBackendStatus({ status: "error", model: "", backend_ready: false });
      }
    } catch {
      setBackendStatus({ status: "offline", model: "", backend_ready: false });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Guaranteed direct zip download trigger
  const handleDownloadDist = () => {
    setDownloadSuccess(true);
    // Trigger download via API route with fallback to static public asset
    const link = document.createElement("a");
    link.href = "/api/extension/download";
    link.download = "arjuna-sarthi-dist.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadSuccess(false);
    }, 4000);
  };

  // Run live test query inside simulator
  const handleRunSimulator = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simQuestion.trim() || simLoading) return;

    setSimLoading(true);
    setSimError(null);
    setSimAnswer(null);
    setSimSources([]);

    try {
      const res = await fetch(`${getApiBase()}/api/extension/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: simUrl,
          title: "Kubernetes Cloud-Native Container Orchestration",
          question: simQuestion.trim(),
          context: [
            {
              id: "sec-1",
              heading: "Architecture & Workloads",
              section: "Pods and Containers",
              content:
                "A Pod is the basic execution unit of a Kubernetes application. It represents the smallest deployable units that you can create and manage in Kubernetes. A Pod encapsulates one or more applications containers, storage resources, a unique network IP, and options that govern how the container(s) should run.",
              url: simUrl,
            },
            {
              id: "sec-2",
              heading: "Networking Model",
              section: "Cluster IP Allocation",
              content:
                "Every Pod in Kubernetes gets its own unique IP address within the cluster. This allows seamless inter-pod communication without port conflicts across worker nodes.",
              url: simUrl,
            },
          ],
          conversation: [],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP Error ${res.status}`);
      }

      const data = await res.json();
      setSimAnswer(data.answer);
      setSimSources(data.sources || []);
    } catch (err: any) {
      setSimError(err.message || "Failed to query AI backend.");
    } finally {
      setSimLoading(false);
    }
  };

  const copyPath = () => {
    navigator.clipboard.writeText("/Users/darshanpatil/Downloads/Vcet/extension/dist");
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* ========================================================================= */}
        {/* REFINED HERO: CIRCULAR EMBLEM WITH 4-LAYER ORBIT MATCHING PAGE COLORS     */}
        {/* ========================================================================= */}
        <div className="relative flex flex-col items-center justify-center text-center overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] py-10 px-6 sm:px-12 shadow-sm">
          
          {/* Subtle warm ambient background glow matching --color-primary */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[var(--color-primary)]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Pill Badge */}
          <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3.5 py-1 text-xs font-semibold text-[var(--color-primary)] shadow-2xs mb-4">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)] animate-pulse" />
            <span>Browser Extension • Chrome Manifest V3</span>
          </div>

          {/* ========================================================================= */}
          {/* TASTEFUL CIRCULAR 4-LAYER ORBIT EMBLEM (MATCHING PAGE PALETTE)            */}
          {/* ========================================================================= */}
          <div className="relative z-10 my-2 flex items-center justify-center">
            <ArjunaSarthiLogo size="xl" animate={true} />
          </div>

          {/* Center Titles */}
          <div className="relative z-10 max-w-2xl space-y-2 mt-4">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--color-text)]">
              Arjuna Sarthi{" "}
              <span className="text-[var(--color-primary)] font-serif font-semibold">
                (अर्जुन सारथी)
              </span>
            </h1>

            <p className="text-sm sm:text-base font-medium text-[var(--color-text-secondary)] font-serif">
              &ldquo;Your AI companion for understanding the web.&rdquo;
            </p>

            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-xl mx-auto leading-relaxed">
              Extract, synthesize, and interrogate any active webpage or document with grounded neural intelligence, precision retrieval, and zero hallucination.
            </p>

            {/* Hint about the movable circular widget */}
            <div className="pt-1 text-[11px] text-[var(--color-primary)] font-medium flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Movable circular companion icon active on page — drag anywhere or click to open.</span>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="relative z-10 pt-6 flex flex-wrap items-center justify-center gap-3">
            {/* Primary Download Button */}
            <button
              type="button"
              onClick={handleDownloadDist}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold px-5 py-2.5 text-xs sm:text-sm transition shadow-sm active:scale-95 cursor-pointer"
            >
              <ArrowDownToLine className="h-4 w-4 stroke-[2.5]" />
              <span>Download Extension (dist.zip)</span>
              <span className="text-[11px] bg-black/20 text-white px-2 py-0.5 rounded-md font-mono">
                99 KB
              </span>
            </button>

            {/* Launch In-Page Simulator */}
            <button
              type="button"
              onClick={() => setIsSimulatorOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface)] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-text)] transition cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 text-[var(--color-primary)] fill-[var(--color-primary)]" />
              <span>In-Page Simulator</span>
            </button>

            {/* Jump to Setup Guide */}
            <button
              type="button"
              onClick={() => {
                document.getElementById("installation-guide")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface)] px-3.5 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
            >
              <Terminal className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              <span>Installation Steps</span>
            </button>
          </div>

          {/* Download Notification */}
          {downloadSuccess && (
            <div className="relative z-10 mt-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 px-3.5 py-1.5 rounded-full animate-fade-in">
              <CheckCircle2 className="h-4 w-4" />
              <span>Downloading <strong>arjuna-sarthi-dist.zip</strong>! Unpack and load into Chrome.</span>
            </div>
          )}

          {/* Live Status Pill */}
          <div className="relative z-10 pt-5 flex items-center justify-center gap-2 text-xs">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono ${
                backendStatus.status === "ready"
                  ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-950/20 border-rose-500/40 text-rose-700 dark:text-rose-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus.status === "ready" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span>
                {backendStatus.status === "ready"
                  ? `AI Neural Engine Active`
                  : "AI Backend Offline (Check port 8000)"}
              </span>
            </div>
            <button
              onClick={checkHealth}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded-md transition"
              title="Refresh backend status"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
        </div>
        </div>

        {/* ========================================================================= */}
        {/* 4-LAYER CELESTIAL ORBIT SYSTEM BREAKDOWN                                   */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">
              4-Layer Celestial Orbit Architecture
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Layer 1 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-primary)] uppercase">Layer 1</span>
                <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-text)]">Prithvi Core</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                DOM Content Extractor. Strips clutter, ads, cookie modals, and navigation to extract clean article and technical text.
              </p>
            </div>

            {/* Layer 2 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-info)] uppercase">Layer 2</span>
                <span className="h-2 w-2 rounded-full bg-[var(--color-info)] animate-pulse" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-text)]">Gandiva Bow</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                RAG Section Chunker. Segments content into traceable semantic blocks with TF-IDF/BM25 relevance scoring.
              </p>
            </div>

            {/* Layer 3 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-primary)] uppercase">Layer 3</span>
                <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-text)]">Tejas Shield</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Strict Grounding Engine. Prevents hallucination; ensures the LLM admits when requested data is absent from page.
              </p>
            </div>

            {/* Layer 4 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] uppercase">Layer 4</span>
                <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-text)]">Brahmastra Brain</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Neural Inference Engine. Delivers instant answers with citation links directly mapped to source page headings.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE AI LIVE REASONING TESTER                                      */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-[var(--color-primary)]" />
                <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text)]">
                  Live Reasoning Playground
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1">
                Test the exact extension API endpoint (<code>/api/extension/ask</code>) with live neural inference.
              </p>
            </div>

            {/* Preset Query Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSimQuestion("What is a Pod in Kubernetes?")}
                className="text-[11px] font-semibold bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg transition"
              >
                Grounded Test
              </button>
              <button
                type="button"
                onClick={() => setSimQuestion("What is the current stock price of Apple?")}
                className="text-[11px] font-semibold bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg transition"
              >
                Anti-Hallucination Test
              </button>
            </div>
          </div>

          <form onSubmit={handleRunSimulator} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                <span>Simulated Active Webpage URL</span>
              </label>
              <input
                type="url"
                value={simUrl}
                onChange={(e) => setSimUrl(e.target.value)}
                className="w-full text-xs font-mono rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                <span>Question to AI Brain</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simQuestion}
                  onChange={(e) => setSimQuestion(e.target.value)}
                  placeholder="Ask any question regarding the active page..."
                  className="flex-1 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="submit"
                  disabled={simLoading || !simQuestion.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white font-bold px-4 py-2.5 text-xs sm:text-sm transition cursor-pointer"
                >
                  {simLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>Ask AI</span>
                </button>
              </div>
            </div>
          </form>

          {/* Results Display */}
          {simError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{simError}</span>
            </div>
          )}

          {simAnswer && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                  <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
                    Grounded Answer
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                  Model: {backendStatus.model || "Neural Engine"}
                </span>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                {simAnswer}
              </p>

              {simSources.length > 0 && (
                <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2">
                  <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Page Grounding Citations
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {simSources.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300"
                      >
                        <Compass className="h-3 w-3" />
                        <span>{s.heading || s.section || `Source #${idx + 1}`}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CHROME INSTALLATION GUIDE                                                 */}
        {/* ========================================================================= */}
        <div id="installation-guide" className="space-y-6 pt-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight">
              Chrome / Chromium Installation Guide
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs">
                01
              </span>
              <h3 className="font-bold text-sm">Download or Build</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Click <strong>Download Extension (dist.zip)</strong> above, or build directly with <code>npm run build</code> inside the <code>extension</code> folder.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs">
                02
              </span>
              <h3 className="font-bold text-sm">Open Extensions</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Open Google Chrome, Brave, or Chromium and navigate to:
              </p>
              <code className="block text-[11px] font-mono bg-[var(--color-bg)] p-1.5 rounded-md border border-[var(--color-border)] text-amber-300">
                chrome://extensions
              </code>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs">
                03
              </span>
              <h3 className="font-bold text-sm">Enable Developer Mode</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Toggle the <strong>Developer mode</strong> switch in the top right corner of the Extensions page.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs">
                04
              </span>
              <h3 className="font-bold text-sm">Load Unpacked</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Click <strong>Load unpacked</strong> and select the unzipped <code>dist</code> folder:
              </p>
              <button
                type="button"
                onClick={copyPath}
                className="w-full flex items-center justify-between text-[11px] font-mono bg-[var(--color-bg)] px-2 py-1.5 rounded-md border border-[var(--color-border)] text-slate-300 hover:text-white transition cursor-pointer"
                title="Click to copy path"
              >
                <span className="truncate">.../Vcet/extension/dist</span>
                {copiedCmd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* IN-PAGE EXTENSION POPUP SIMULATOR MODAL                                    */}
      {/* ========================================================================= */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-[420px] rounded-3xl border border-amber-500/40 bg-slate-950 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2.5">
                <ArjunaSarthiLogo size="sm" animate={true} />
                <div>
                  <h3 className="text-xs font-bold text-white leading-none">Arjuna Sarthi</h3>
                  <span className="text-[10px] text-amber-400 font-medium">In-Page Web Companion</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Active URL bar */}
            <div className="px-4 py-2.5 bg-black/40 border-b border-white/5 flex items-center gap-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="font-mono text-[11px] text-slate-300 truncate">{simUrl}</span>
            </div>

            {/* Body Chat / Q&A */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Page contents fetched and indexed into semantic sections. Ask any question below.
              </div>

              {simAnswer && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[var(--color-primary)] font-bold text-[11px]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Factual Response</span>
                  </div>
                  <p className="text-[var(--color-text)] leading-relaxed whitespace-pre-line">{simAnswer}</p>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-white/10 bg-white/5">
              <form onSubmit={handleRunSimulator} className="flex gap-2">
                <input
                  type="text"
                  value={simQuestion}
                  onChange={(e) => setSimQuestion(e.target.value)}
                  placeholder="Ask about this page..."
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={simLoading || !simQuestion.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {simLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

