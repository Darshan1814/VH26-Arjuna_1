"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Mic } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  isLoading: boolean;
  isWhatIfMode?: boolean;
  onToggleWhatIf?: () => void;
}

export function ChatInput({
  onSend,
  isLoading,
  isWhatIfMode = false,
  onToggleWhatIf,
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  return (
    <div className="space-y-1.5">
      {/* What-If Mode Indicator & Quick Toggle */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onToggleWhatIf}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            isWhatIfMode
              ? "bg-purple-600 text-white shadow-sm ring-1 ring-purple-400"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
          }`}
          title="Toggle Evidence-Based What-If Analysis Mode"
        >
          <span>🔮</span>
          <span>What-If</span>
          {isWhatIfMode && <span className="text-[10px] opacity-80">(Active)</span>}
        </button>

        {isWhatIfMode && (
          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            What-If Analysis Mode Active
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            data-chat-input
            aria-label="Describe machine issue, error code, or ask a What-If scenario"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isWhatIfMode
                ? "Ask a hypothetical question (e.g. 'What if I continue running the machine?')..."
                : "Describe the machine issue or enter an error code..."
            }
            className={`input-base resize-none pr-10 ${
              isWhatIfMode ? "border-purple-400 focus:ring-purple-400" : ""
            }`}
            rows={1}
            disabled={isLoading}
          />
          {/* Mic icon placeholder */}
          <button
            className="absolute right-3 bottom-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Voice input (coming soon)"
            type="button"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className={`btn-primary h-[42px] w-[42px] flex-shrink-0 !p-0 ${
            isWhatIfMode ? "!bg-purple-600 hover:!bg-purple-700" : ""
          }`}
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
