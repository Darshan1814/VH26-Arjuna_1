"use client";

import { useRef, useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { Wrench, Trash2 } from "lucide-react";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">
            Troubleshooting Assistant
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Ask about error codes, machine issues, or troubleshooting steps
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-error)] transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState onSelectSuggestion={sendMessage} />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onSelectSuggestion: (suggestion: string) => void;
}

function EmptyState({ onSelectSuggestion }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="rounded-2xl bg-[var(--color-surface)] p-4 mb-4">
        <Wrench className="h-8 w-8 text-[var(--color-primary)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
        Machine Troubleshooter
      </h2>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)] mb-6">
        Get diagnostic help from service manuals. Ask about error codes, 
        symptoms, or troubleshooting procedures.
      </p>
      <div className="grid gap-2 text-left w-full max-w-sm">
        {[
          "What does error E101 mean?",
          "Why is my CNC-X100 overheating?",
          "What does E101 mean on PRESS-Z200?",
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-lg border bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors text-left"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            &ldquo;{suggestion}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}
