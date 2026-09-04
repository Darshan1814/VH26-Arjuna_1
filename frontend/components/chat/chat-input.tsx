"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Mic } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: Props) {
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
    <div className="flex items-end gap-2">
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          data-chat-input
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Describe the machine issue or enter an error code..."
          className="input-base resize-none pr-10"
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
        className="btn-primary h-[42px] w-[42px] flex-shrink-0 !p-0"
        title="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
