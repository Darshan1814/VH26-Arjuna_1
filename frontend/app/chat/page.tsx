"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { uploadKnowledgeFiles } from "@/lib/api";
import {
  Wrench,
  Trash2,
  UploadCloud,
  FileCheck,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadStatus("Uploading & processing technical knowledge...");

    try {
      const fileList = Array.from(files);
      const res = await uploadKnowledgeFiles(fileList);
      setUploadStatus(
        `Successfully ingested ${res.files_processed} file(s) (${res.total_chunks_stored} chunks indexed).`
      );
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
            Multi-manual grounded troubleshooting with evidence highlighting
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
            <span>Add Knowledge</span>
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

      {/* Input area */}
      <div className="border-t p-4 bg-[var(--color-surface)]">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onSelectSuggestion: (suggestion: string) => void;
  onOpenUpload: () => void;
}

function EmptyState({ onSelectSuggestion, onOpenUpload }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-4">
      <div className="rounded-2xl bg-[var(--color-surface-elevated)] border p-4 mb-4 shadow-sm">
        <Wrench className="h-8 w-8 text-[var(--color-primary)]" />
      </div>
      <h2 className="text-lg font-bold text-[var(--color-text)] mb-1">
        Industrial Machine Troubleshooting
      </h2>
      <p className="max-w-md text-xs text-[var(--color-text-muted)] mb-6 leading-relaxed">
        Grounded diagnostic assistant backed by OEM manuals, wiring schematics, and error logs.
        Every recommendation is verified against source documents with page citations.
      </p>

      {/* Sample query pills */}
      <div className="grid gap-2 text-left w-full max-w-md">
        <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          Test Diagnostic Scenarios
        </div>
        {[
          "Error E101 on CNC-X100: Spindle motor thermal trip",
          "What does error code E101 mean?",
          "Hydraulic pressure loss with abnormal vibration on PRESS-Z200",
          "What is error E999 on unknown machine?",
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-lg border bg-[var(--color-surface)] px-4 py-2.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors text-left shadow-xs flex items-center justify-between group"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            <span>&ldquo;{suggestion}&rdquo;</span>
            <span className="text-[10px] text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition">
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
          Or upload new service manuals (PDF, DOCX, Images, CSV, Logs)
        </button>
      </div>
    </div>
  );
}
