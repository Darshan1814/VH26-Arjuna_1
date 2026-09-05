"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { uploadKnowledgeFiles, getManualSuggestions } from "@/lib/api";
import {
  Wrench,
  Trash2,
  UploadCloud,
  FileCheck,
  Loader2,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const { t } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Dynamic suggestions derived from the actual uploaded manual
  const [suggestions, setSuggestions] = useState<string[]>([
    "What are the primary troubleshooting steps for motor starting failure?",
    "How do I inspect electrical input voltage, balance, and earthing?",
    "What safety precautions must be followed before servicing control cabinets?",
    "How to identify root causes for abnormal vibration or overheating?",
  ]);
  const [hasUploaded, setHasUploaded] = useState<boolean>(false);
  const [activeManualTitle, setActiveManualTitle] = useState<string>("");

  const loadSuggestions = async () => {
    try {
      const res = await getManualSuggestions();
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      }
      if (res.active_manual) {
        setActiveManualTitle(res.active_manual);
        setHasUploaded(true);
      }
    } catch (err) {
      console.warn("Could not load dynamic suggestions, using verified defaults:", err);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadStatus("Uploading & scanning technical documentation in the background...");

    try {
      const fileList = Array.from(files);
      const res = await uploadKnowledgeFiles(fileList);
      setUploadStatus(
        `Successfully ingested ${res.files_processed} file(s) (${res.total_chunks_stored} chunks indexed).`
      );
      setHasUploaded(true);
      setActiveManualTitle(fileList[0].name);
      loadSuggestions();
      setTimeout(() => setUploadStatus(null), 6000);
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message || "Unknown error"}`);
      setTimeout(() => setUploadStatus(null), 8000);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div
      className={`flex flex-col flex-1 h-[calc(100dvh-3.5rem)] w-full transition-colors ${
        isDragOver ? "bg-blue-50/20 dark:bg-blue-950/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.png,.jpg,.jpeg,.csv,.log,.txt"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Chat header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-[var(--color-text)] flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
            <span>{t("Industrial Diagnostic Assistant")}</span>
          </h1>
          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap">
            <span>
              {t("Active Knowledge Base")}:{" "}
              <span className="font-medium text-[var(--color-text)]">
                {hasUploaded ? activeManualTitle : t("Universal OEM Diagnostic Engine")}
              </span>
            </span>
            {hasUploaded && (
              <button
                onClick={() => {
                  setHasUploaded(false);
                  setActiveManualTitle("");
                  setUploadStatus("Active manual selection cleared.");
                  setTimeout(() => setUploadStatus(null), 4000);
                }}
                className="text-[10px] text-red-600 dark:text-red-400 hover:underline font-semibold cursor-pointer"
                title="Clear selected manual"
              >
                ({t("Clear")})
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick multi-format upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition shadow-xs disabled:opacity-50 cursor-pointer"
            title={t("Upload manuals, diagrams, logs, or error codes (PDF, DOCX, PNG, CSV, LOG)")}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{t("Upload Manual")}</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-red-600 transition-colors cursor-pointer"
              title={t("Clear conversation")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Upload notification banner */}
      {uploadStatus && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 px-4 py-2 text-xs flex items-center gap-2 text-blue-800 dark:text-blue-300">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
          ) : (
            <FileCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
          )}
          <span className="flex-1">{uploadStatus}</span>
        </div>
      )}

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className="border-b border-dashed border-blue-400 bg-blue-100/50 dark:bg-blue-900/30 p-2 text-center text-xs font-semibold text-blue-700 dark:text-blue-300">
          Drop PDF manuals, diagrams, CSVs, or logs here to ingest
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="w-full max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <EmptyState
              hasUploaded={hasUploaded}
              activeManual={activeManualTitle}
              suggestions={suggestions}
              onSelectSuggestion={sendMessage}
              onOpenUpload={() => fileInputRef.current?.click()}
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSelectOption={sendMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] p-3 sm:p-4 bg-[var(--color-surface)]">
        <div className="w-full max-w-4xl mx-auto">
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  hasUploaded: boolean;
  activeManual: string;
  suggestions: string[];
  onSelectSuggestion: (suggestion: string) => void;
  onOpenUpload: () => void;
}

function EmptyState({
  hasUploaded,
  activeManual,
  suggestions,
  onSelectSuggestion,
  onOpenUpload,
}: EmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-4 max-w-xl mx-auto py-8">
      <div className="rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-4 mb-4 shadow-sm">
        <Wrench className="h-8 w-8 text-[var(--color-primary)] mx-auto" />
      </div>

      <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
        {t("Industrial Machine Troubleshooting")}
      </h2>

      <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mb-4 leading-relaxed">
        {t("Industrial diagnostic reasoning engine with verified search citations. Inquire about any machine fault, alarm code, or physical symptom directly — or optionally upload an equipment manual to ground citations.")}
      </p>

      {hasUploaded ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300 mb-5">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{t("Active Grounding Manual")}: <strong>{activeManual}</strong></span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition shadow-xs cursor-pointer"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>{t("Upload Manual (Optional)")}</span>
          </button>
        </div>
      )}

      {/* Diagnostic Suggestions */}
      <div className="grid gap-2 text-left w-full">
        <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          {t("Quick Diagnostic Inquiries")}
        </div>
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition text-left shadow-xs flex items-center justify-between group cursor-pointer"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            <span className="truncate mr-2">&ldquo;{t(suggestion)}&rdquo;</span>
            <span className="text-[10px] font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {t("Run")} →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
