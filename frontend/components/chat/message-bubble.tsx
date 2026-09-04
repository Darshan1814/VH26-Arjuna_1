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

            {/* Probable causes */}
            {(rag.probable_causes?.length ?? 0) > 0 && (
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

            {/* Corrective steps */}
            {(rag.corrective_steps?.length ?? 0) > 0 && (
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
