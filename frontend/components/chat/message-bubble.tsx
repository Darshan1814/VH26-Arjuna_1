"use client";

import type { ChatMessage } from "@/types";
import { Bot, User, AlertTriangle, Loader2 } from "lucide-react";
import { CitationCard } from "@/components/chat/citation-card";
import { ConfidenceBadge } from "@/components/chat/confidence-badge";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const rag = message.ragResponse;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
            <Bot className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Message content */}
      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-[var(--color-primary)] text-white rounded-br-md"
              : "bg-[var(--color-surface)] text-[var(--color-text)] rounded-bl-md"
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing manuals...</span>
            </div>
          ) : message.isError ? (
            <div className="flex items-center gap-2 text-[var(--color-error)]">
              <AlertTriangle className="h-4 w-4" />
              <span>{message.content}</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* RAG response details */}
        {rag && !message.isLoading && !message.isError && (
          <div className="space-y-2">
            {/* Ambiguity warning */}
            {rag.is_ambiguous && (rag.ambiguous_machines?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {rag.ambiguous_machines.map((machine) => (
                  <span key={machine} className="badge-warning">
                    {machine}
                  </span>
                ))}
              </div>
            )}

            {/* Insufficient info warning */}
            {rag.is_insufficient && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)] bg-yellow-50 dark:bg-yellow-900/10 p-2.5 text-xs text-[var(--color-warning)]">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{rag.insufficient_message}</span>
              </div>
            )}

            {/* What-If Analysis Evidence Panel & Structured Details */}
            {rag.is_what_if && rag.what_if_analysis && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 p-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                    <span>🔮</span> What-If Analysis Grounding
                  </span>
                  {rag.what_if_analysis.scenario_type && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold">
                      {rag.what_if_analysis.scenario_type.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {/* Evidence Panel (Expandable) */}
                <details className="group text-xs text-[var(--color-text-secondary)]" open>
                  <summary className="cursor-pointer font-medium text-purple-800 dark:text-purple-200 hover:underline flex items-center gap-1 py-1">
                    <span>🔍</span> Why this analysis? (Manual Evidence & Inferences)
                  </summary>
                  <div className="mt-2 space-y-1.5 pl-2.5 border-l-2 border-purple-300 dark:border-purple-800">
                    {rag.what_if_analysis.documented_facts?.map((fact, i) => (
                      <div key={`doc-${i}`} className="flex items-start gap-1.5">
                        <span className="flex-shrink-0">📘</span>
                        <span><strong className="text-[var(--color-text)]">Manual Evidence:</strong> {fact}</span>
                      </div>
                    ))}
                    {rag.what_if_analysis.reasoned_inferences?.map((inf, i) => (
                      <div key={`inf-${i}`} className="flex items-start gap-1.5">
                        <span className="flex-shrink-0">🧠</span>
                        <span><strong className="text-[var(--color-text)]">Reasoned Inference:</strong> {inf}</span>
                      </div>
                    ))}
                    {rag.what_if_analysis.unknowns?.map((unk, i) => (
                      <div key={`unk-${i}`} className="flex items-start gap-1.5 text-[var(--color-text-muted)]">
                        <span className="flex-shrink-0">❓</span>
                        <span><strong>Unknown:</strong> {unk}</span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Action Comparison Table if present */}
                {(rag.what_if_analysis.comparison_table?.length ?? 0) > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <p className="text-xs font-semibold text-[var(--color-text)] mb-1">
                      Action Comparison
                    </p>
                    <table className="w-full text-left text-xs border-collapse border rounded">
                      <thead>
                        <tr className="border-b bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                          <th className="p-1.5 font-semibold">Action</th>
                          <th className="p-1.5 font-semibold">Relevance</th>
                          <th className="p-1.5 font-semibold">Intervention</th>
                          <th className="p-1.5 font-semibold">Documentation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {rag.what_if_analysis.comparison_table.map((item, i) => (
                          <tr key={i} className="text-[var(--color-text-secondary)]">
                            <td className="p-1.5 font-medium text-[var(--color-text)]">{item.action}</td>
                            <td className="p-1.5">{item.relevance}</td>
                            <td className="p-1.5">{item.intervention_level}</td>
                            <td className="p-1.5">{item.manual_supported ? "✅ Supported" : "⚠️ Unverified"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Hypothetical progression timeline if present */}
                {(rag.what_if_analysis.timeline?.length ?? 0) > 1 && (
                  <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-900/40 text-xs">
                    <p className="font-semibold text-[var(--color-text)] mb-1">Hypothetical Progression</p>
                    <div className="space-y-1">
                      {rag.what_if_analysis.timeline.map((step, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Probable causes (when not what-if or when provided) */}
            {!rag.is_what_if && (rag.probable_causes?.length ?? 0) > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Probable Causes
                </p>
                <ul className="space-y-1">
                  {rag.probable_causes.map((cause, i) => (
                    <li key={i} className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-warning)]" />
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Corrective steps (when not what-if or when provided) */}
            {!rag.is_what_if && (rag.corrective_steps?.length ?? 0) > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Corrective Steps
                </p>
                <ol className="space-y-1 list-decimal list-inside">
                  {rag.corrective_steps.map((step, i) => (
                    <li key={i} className="text-[var(--color-text-secondary)]">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Confidence + Citations row */}
            <div className="flex items-center gap-2 flex-wrap">
              <ConfidenceBadge confidence={rag.confidence ?? 0} />
              {rag.is_what_if && (
                <span className="badge bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                  🔮 What-If Analysis
                </span>
              )}
              {rag.detected_error_code && (
                <span className="badge-info">
                  {rag.detected_error_code}
                </span>
              )}
              {rag.detected_machine && (
                <span className="badge bg-[var(--color-surface)] text-[var(--color-text-secondary)] border">
                  {rag.detected_machine}
                </span>
              )}
            </div>

            {/* Citations */}
            {(rag.citations?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                  Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rag.citations.map((citation, i) => (
                    <CitationCard key={i} citation={citation} index={i + 1} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
            <User className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
}
