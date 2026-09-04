"use client";

import { useState } from "react";
import type { ChatMessage } from "@/types";
import {
  Bot,
  User,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
  Download,
  ExternalLink,
  ShieldAlert,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { CitationCard } from "@/components/chat/citation-card";
import { useLanguage } from "@/context/language-context";

interface Props {
  message: ChatMessage;
  onSelectOption?: (text: string) => void;
}

export function MessageBubble({ message, onSelectOption }: Props) {
  const { t } = useLanguage();
  const isUser = message.role === "user";
  const rag = message.ragResponse;
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);

  // Confidence styling
  const getConfidenceBadge = (level?: string, score?: number) => {
    const s = Math.round((score ?? 0) * 100);
    if (level === "HIGH" || s >= 80) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          {t("HIGH Confidence")} ({s}%)
        </span>
      );
    } else if (level === "LOW" || s < 50) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-3 w-3" />
          {t("LOW Confidence")} ({s}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {t("MEDIUM Confidence")} ({s}%)
      </span>
    );
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Message content */}
      <div className={`max-w-[85%] space-y-3 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-[var(--color-primary)] text-white rounded-br-none"
              : "bg-[var(--color-surface)] text-[var(--color-text)] border rounded-bl-none"
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] py-1">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
              <span>{t("Analyzing technical documentation, logs & manuals...")}</span>
            </div>
          ) : message.isError ? (
            <div className="flex items-center gap-2 text-[var(--color-error)]">
              <AlertTriangle className="h-4 w-4" />
              <span>{message.content}</span>
            </div>
          ) : (
            <div>
              {rag?.diagnosis && (
                <div className="mb-2 pb-2 border-b border-[var(--color-border)]">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-primary)]">
                    {t("Diagnostic Finding:")}
                  </span>
                  <p className="font-medium text-[var(--color-text)] mt-0.5">{rag.diagnosis}</p>
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          )}
        </div>

        {/* Structured details for Assistant Responses */}
        {rag && !message.isLoading && !message.isError && (
          <div className="space-y-3">
            {/* Safety Warnings Banner */}
            {(rag.safety_warnings?.length ?? 0) > 0 && (
              <div className="rounded-lg border-2 border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-900 dark:text-red-300">
                <div className="flex items-center gap-1.5 font-bold mb-1 uppercase tracking-wide">
                  <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  {t("Mandatory Safety Precautions")}
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {rag.safety_warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Disambiguation Prompt & Selectable Machine Buttons */}
            {rag.is_ambiguous && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>{t("Ambiguity Detected — Please Specify Equipment:")}</span>
                </div>
                {rag.ambiguity_message && (
                  <p className="text-amber-800 dark:text-amber-400">{rag.ambiguity_message}</p>
                )}
                {rag.ambiguous_machines && rag.ambiguous_machines.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {rag.ambiguous_machines.map((machine) => (
                      <button
                        key={machine}
                        onClick={() =>
                          onSelectOption?.(
                            `Troubleshoot error ${rag.detected_error_code || ""} for machine ${machine}`
                          )
                        }
                        className="rounded-md bg-white dark:bg-neutral-800 border border-amber-400 dark:border-amber-600 px-3 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-amber-100 dark:hover:bg-neutral-700 transition-colors shadow-xs"
                      >
                        Model: {machine} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Insufficient info refusal */}
            {rag.is_insufficient && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">{t("Insufficient Information")}</p>
                  <p className="mt-0.5">{rag.insufficient_message || "Insufficient information in the available sources."}</p>
                </div>
              </div>
            )}

            {/* Ranked Solutions */}
            {rag.recommended_solutions && rag.recommended_solutions.length > 0 && (
              <div className="rounded-lg border bg-[var(--color-surface)] p-3 text-xs space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-[var(--color-text)] uppercase tracking-wider text-[11px]">
                    {t("Ranked Corrective Solutions")}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {t("Ranked by Evidence Strength")}
                  </span>
                </div>
                <div className="space-y-2 pt-1">
                  {rag.recommended_solutions.map((sol, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-dashed border-[var(--color-border)] p-2.5 bg-[var(--color-surface-elevated)] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--color-primary)]">
                          #{sol.priority || idx + 1} {sol.action}
                        </span>
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                          {sol.evidence_strength || "Strong"} Evidence
                        </span>
                      </div>
                      <p className="text-[var(--color-text-secondary)]">{sol.reason}</p>
                      {sol.source && (
                        <p className="text-[10px] text-[var(--color-text-muted)] italic">
                          Source: {sol.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Highlighted Evidence Images */}
            {rag.evidence_images && rag.evidence_images.length > 0 && (
              <div className="rounded-lg border bg-[var(--color-surface)] p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[var(--color-text)] uppercase tracking-wider text-[11px]">
                  <ImageIcon className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  {t("Yellow-Highlighted Source Manual Evidence")}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {rag.evidence_images.map((ev, i) => (
                    <div
                      key={i}
                      className="group cursor-pointer rounded border overflow-hidden bg-neutral-900"
                      onClick={() => setActiveModalImage(ev.url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ev.url}
                        alt={ev.caption || "Source manual evidence"}
                        className="h-28 w-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                      <div className="p-1.5 bg-[var(--color-surface-elevated)] border-t text-[10px] truncate text-[var(--color-text-secondary)]">
                        {ev.caption}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta Row: Confidence Badge & Entity Tags */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {getConfidenceBadge(rag.confidence_level, rag.confidence)}
              {rag.detected_error_code && (
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-xs font-mono font-semibold text-blue-700 dark:text-blue-400">
                  {rag.detected_error_code}
                </span>
              )}
              {rag.detected_machine && (
                <span className="rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-400">
                  {rag.detected_machine}
                </span>
              )}
            </div>

            {/* Citations List */}
            {rag.citations && rag.citations.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t("Source Citations")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rag.citations.map((citation, i) => (
                    <CitationCard key={i} citation={citation} index={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Report Actions */}
            {(rag.report_pdf_url || rag.report_html_url || (rag.diagnosis && !rag.is_insufficient)) && (
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={rag.report_pdf_url || `/api/reports/${rag.report_id || "CURRENT"}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-neutral-50 dark:hover:bg-neutral-700 transition shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-blue-600" />
                  {t("Download PDF Report")}
                </a>
                <a
                  href={rag.report_html_url || `/api/reports/${rag.report_id || "CURRENT"}/html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-neutral-50 dark:hover:bg-neutral-700 transition shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                  {t("View HTML Report")}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface)] border text-[var(--color-text-secondary)] shadow-xs">
            <User className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Image Modal Lightbox */}
      {activeModalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveModalImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-neutral-900 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModalImage(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeModalImage}
              alt="Highlighted Evidence Full"
              className="max-h-[85vh] w-auto object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
