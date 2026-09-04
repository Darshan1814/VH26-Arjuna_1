"use client";

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
  BookOpen,
  ArrowDown,
} from "lucide-react";

const flowSteps = [
  {
    id: "manuals",
    title: "PDF Manuals",
    description:
      "Service manuals are uploaded in PDF format. Each manual is linked to a specific machine model.",
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "processing",
    title: "Document Processing",
    description:
      "PyMuPDF extracts text, detects structure (headings, sections), and identifies page layouts.",
    icon: ScanLine,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  {
    id: "ocr",
    title: "OCR / Layout Extraction",
    description:
      "Scanned pages are processed with Tesseract OCR. Text and image regions are detected separately.",
    icon: BookOpen,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "chunking",
    title: "Chunking",
    description:
      "Text is split into overlapping chunks with section, page, and error code metadata preserved.",
    icon: Layers,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  {
    id: "embeddings",
    title: "Embeddings (BGE-M3)",
    description:
      "Each chunk is embedded using BAAI/bge-m3 into a 1024-dimensional vector for semantic search.",
    icon: Binary,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    id: "storage",
    title: "Supabase pgvector",
    description:
      "Vectors, text, and metadata are stored in PostgreSQL with pgvector extension for fast similarity search.",
    icon: Database,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "retrieval",
    title: "Hybrid Retrieval",
    description:
      "Combines exact error-code matching, keyword search, and vector similarity. Machine metadata filters prevent cross-manual confusion.",
    icon: Search,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
  },
  {
    id: "reranking",
    title: "Reranking (BGE Reranker)",
    description:
      "Retrieved chunks are reranked using a cross-encoder model to improve precision before generation.",
    icon: ArrowUpDown,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "context",
    title: "Context Assembly",
    description:
      "Top-ranked chunks are assembled with source metadata into a structured context window for verified generation.",
    icon: Puzzle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "generation",
    title: "Context-Verified Generation",
    description:
      "Context and query are evaluated with a strict evidence prompt that restricts answers to retrieved manual excerpts only. No unsupported procedures allowed.",
    icon: Cpu,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
  },
  {
    id: "response",
    title: "Cited Solution",
    description:
      "Structured response with troubleshooting steps, probable causes, confidence score, and traceable source citations.",
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

export default function ProcessFlowPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-2">
          RAG Pipeline Architecture
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-lg mx-auto">
          How the Machine Troubleshooter processes service manuals and generates
          cited troubleshooting answers using Retrieval-Augmented Generation.
        </p>
      </div>

      {/* Flow */}
      <div className="space-y-0">
        {flowSteps.map((step, index) => (
          <div key={step.id}>
            {/* Step card */}
            <div className="card flex items-start gap-4 relative">
              {/* Step number */}
              <div className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] border text-xs font-semibold text-[var(--color-text-muted)]">
                {index + 1}
              </div>

              {/* Icon */}
              <div className={`flex-shrink-0 rounded-xl p-2.5 ${step.bgColor}`}>
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-text)] mb-0.5">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Connector arrow */}
            {index < flowSteps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-[var(--color-text-muted)] opacity-40" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 rounded-lg border border-dashed p-4 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          The pipeline enforces strict evidence-based answers. If retrieved evidence
          is insufficient, the system will not hallucinate — it will clearly state
          that it lacks information.
        </p>
      </div>
    </div>
  );
}
