import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { ChatMessage, SourceCitation } from "../types";

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  disabled: boolean;
  isFetched: boolean;
  currentUrl: string;
}

const SAMPLE_QUESTIONS = [
  "What is the main purpose of this page?",
  "Summarize the key takeaways",
  "What are the core technical requirements?",
  "Compare the approaches discussed",
];

export const ChatSection: React.FC<ChatSectionProps> = ({
  messages,
  onSendMessage,
  isLoading,
  disabled,
  isFetched,
  currentUrl,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Ask Arjuna Sarthi</span>
        </h4>
        {messages.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Suggested Quick Prompts (only when fetched and no or few messages) */}
      {isFetched && messages.length === 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-400">
            Suggested inquiries:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(q)}
                disabled={isLoading || disabled}
                className="text-left px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[160px] max-h-[360px] pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-2">
              <Bot className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isFetched
                ? "Page ready for questions."
                : "Click FETCH above to begin understanding this page."}
            </p>
            <p className="text-[11px] text-slate-400 max-w-[260px] mt-0.5">
              {isFetched
                ? "Ask anything about the extracted document or concepts."
                : "Arjuna Sarthi will extract visible text and ground all answers in this document."}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} currentUrl={currentUrl} />
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-1 rounded-lg bg-indigo-600 text-white flex-shrink-0">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>Arjuna Sarthi is reading & reasoning...</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Grounding answer strictly in the fetched webpage context via Groq.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="space-y-1.5 pt-1">
        <div className="relative flex items-end rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder={
              isFetched
                ? "Ask anything about this page... (Enter to send)"
                : "Fetch the page first to enable Q&A..."
            }
            className="w-full resize-none bg-transparent p-2.5 pr-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
            title="Send query (Enter)"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>Shift + Enter for new line</span>
          <span>Grounded in active tab</span>
        </div>
      </form>
    </div>
  );
};

interface MessageItemProps {
  message: ChatMessage;
  currentUrl: string;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, currentUrl }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      className={`flex flex-col ${
        isUser ? "items-end" : "items-start"
      } space-y-1 animate-fade-in`}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
        {isUser ? (
          <>
            <span>You</span>
            <span>•</span>
            <span>{message.timestamp}</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Arjuna Sarthi
            </span>
            <span>•</span>
            <span>{message.timestamp}</span>
          </>
        )}
      </div>

      <div
        className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[92%] shadow-2xs ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-xs"
            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs space-y-2.5"
        }`}
      >
        {/* Error message */}
        {message.error ? (
          <div className="flex items-start gap-1.5 text-rose-600 dark:text-rose-400 text-xs">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{message.error}</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}

        {/* Grounded Source Citations (for assistant answers) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center justify-between w-full text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <span className="flex items-center gap-1">
                <span>Sources & Grounded Context ({message.sources.length})</span>
              </span>
              {sourcesOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {sourcesOpen && (
              <div className="mt-1.5 space-y-1.5">
                {message.sources.map((src: SourceCitation, i: number) => (
                  <div
                    key={i}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-[10px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                        Section: {src.heading || src.section || "Content"}
                      </span>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          title="Open referenced page"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                    {src.snippet && (
                      <p className="text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                        &ldquo;{src.snippet}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
