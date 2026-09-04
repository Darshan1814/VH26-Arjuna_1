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

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Dynamic suggestions derived from the actual uploaded manual
  const [suggestions, setSuggestions] = useState<string[]>([
    "Why is the load motor making a chattering noise on PhaseMaker Rotary Converter?",
    "How to turn ON the Rotary Converter for RC10 and larger models?",
    "What size PhaseMaker RC model is required for a 7.5 kW motor?",
    "How to connect the Soft Starter to U1, V1, W1 on the load motor?",
    "What should I do if the Idler motor does not run after 4-5 seconds of pressing START?",
  ]);
  const [hasUploaded, setHasUploaded] = useState<boolean>(false);
  const [activeManualTitle, setActiveManualTitle] = useState<string>(
    "PhaseMaker Rotary Converter Manual"
  );

  const loadSuggestions = async () => {
    try {
      const res = await getManualSuggestions();
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      }
      if (res.active_manual) {
        setActiveManualTitle(res.active_manual);
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
        `Successfully ingested ${res.files_processed} file(s) (${res.total_chunks_stored} chunks indexed). Refreshing diagnostic suggestions...`
      );
      setHasUploaded(true);
      // Reload suggestions tailored to the newly uploaded document
      await loadSuggestions();
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
      className={`mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col transition-colors ${
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
      <div className="flex items-center justify-between border-b px-4 py-3 bg-[var(--color-surface)]">
        <div>
          <h1 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--color-primary)]" />
            Industrial Diagnostic Assistant
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Active Knowledge Base:{" "}
            <span className="font-medium text-[var(--color-text)]">
              {hasUploaded ? activeManualTitle : "None (Upload document to begin)"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick multi-format upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition shadow-xs disabled:opacity-50"
            title="Upload manuals, diagrams, logs, or error codes (PDF, DOCX, PNG, CSV, LOG)"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            <span>Upload Manual</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-red-600 transition-colors"
              title="Clear conversation"
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
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState
            hasUploaded={hasUploaded}
            activeManual={activeManualTitle}
            suggestions={suggestions}
            onSelectSuggestion={sendMessage}
            onOpenUpload={() => fileInputRef.current?.click()}
            onLoadDefaultManual={() => {
              setHasUploaded(true);
              loadSuggestions();
            }}
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

      {/* Input area */}
      <div className="border-t p-4 bg-[var(--color-surface)]">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
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
  onLoadDefaultManual: () => void;
}

function EmptyState({
  hasUploaded,
  activeManual,
  suggestions,
  onSelectSuggestion,
  onOpenUpload,
  onLoadDefaultManual,
}: EmptyStateProps) {
  if (!hasUploaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
        <div className="rounded-2xl bg-[var(--color-surface-elevated)] border p-5 mb-4 shadow-sm">
          <UploadCloud className="h-10 w-10 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
          Upload Equipment Documentation
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-6">
          Upload an OEM manual, circuit diagram, or error log (PDF, PNG, CSV). Grounded diagnostic suggestions will be dynamically generated once indexed.
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={onOpenUpload}
            className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Select & Upload Manual</span>
          </button>

          <button
            onClick={onLoadDefaultManual}
            className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer text-[var(--color-text-secondary)]"
          >
            <BookOpen className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span>Use Ingested PhaseMaker RC Manual</span>
          </button>
        </div>

        <p className="text-[10px] text-[var(--color-text-muted)] mt-5">
          Supports: PDF, DOCX, PNG, JPG, CSV, LOG, TXT with multilingual extraction.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-4">
      <div className="rounded-2xl bg-[var(--color-surface-elevated)] border p-4 mb-3 shadow-sm">
        <Wrench className="h-8 w-8 text-[var(--color-primary)]" />
      </div>
      <h2 className="text-lg font-bold text-[var(--color-text)] mb-1">
        Industrial Machine Troubleshooting
      </h2>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300 mb-5">
        <BookOpen className="h-3.5 w-3.5" />
        <span>Grounded on: <strong>{activeManual}</strong></span>
      </div>

      {/* Diagnostic Suggestions Derived from Real Manual */}
      <div className="grid gap-2 text-left w-full max-w-lg">
        <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          Verified Diagnostic Questions from Manual
        </div>
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            className="rounded-lg border bg-[var(--color-surface)] px-4 py-2.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors text-left shadow-xs flex items-center justify-between group cursor-pointer"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            <span>&ldquo;{suggestion}&rdquo;</span>
            <span className="text-[10px] font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition whitespace-nowrap ml-2">
              Run →
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={onOpenUpload}
          className="text-xs text-[var(--color-primary)] underline hover:text-[var(--color-primary-hover)] cursor-pointer"
        >
          Upload additional OEM manuals, circuit diagrams, or error logs
        </button>
      </div>
    </div>
  );
}
