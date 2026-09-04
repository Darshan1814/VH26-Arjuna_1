"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Mic, MicOff, Globe } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  isLoading: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "hi-IN", label: "Hindi (हिंदी)", flag: "🇮🇳" },
  { code: "de-DE", label: "German (Deutsch)", flag: "🇩🇪" },
  { code: "es-ES", label: "Spanish (Español)", flag: "🇪🇸" },
  { code: "fr-FR", label: "French (Français)", flag: "🇫🇷" },
  { code: "ja-JP", label: "Japanese (日本語)", flag: "🇯🇵" },
  { code: "zh-CN", label: "Chinese (中文)", flag: "🇨🇳" },
];

export function ChatInput({ onSend, isLoading }: Props) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en-US");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API for Multilingual Voice Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput((prev) => {
            const separator = prev && !prev.endsWith(" ") ? " " : "";
            return `${prev}${separator}${transcript}`.trimStart();
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setSpeechError("Microphone permission denied.");
        } else {
          setSpeechError(`Speech error: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setSpeechError(null), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [selectedLang]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setSpeechError("Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      setTimeout(() => setSpeechError(null), 5000);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = selectedLang;
        recognitionRef.current.start();
        setIsListening(true);
        setSpeechError(null);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsListening(false);
      }
    }
  };

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    onSend(input);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isLoading, isListening, onSend]);

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
      {speechError && (
        <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded border border-red-200 dark:border-red-900 flex items-center justify-between">
          <span>{speechError}</span>
          <button onClick={() => setSpeechError(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {isListening && (
        <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 animate-pulse bg-red-50 dark:bg-red-950/30 px-3 py-1 rounded-lg border border-red-300 dark:border-red-800">
          <span className="h-2 w-2 rounded-full bg-red-600"></span>
          <span>
            Listening in {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label}... Speak now.
          </span>
          <button
            onClick={toggleListening}
            className="ml-auto text-[11px] underline hover:text-red-800"
          >
            Stop
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            data-chat-input
            aria-label="Describe machine issue or error code"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "Listening... Your voice will transcribe here."
                : "Describe the machine fault, alarm, or ask questions from uploaded manuals..."
            }
            className={`input-base resize-none pr-24 ${
              isListening ? "border-red-400 dark:border-red-600 ring-2 ring-red-400/20" : ""
            }`}
            rows={1}
            disabled={isLoading}
          />

          {/* Right Action Icons: Language selector & Mic */}
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1">
            {/* Language Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] transition text-xs flex items-center gap-0.5"
                title={`Speech Language: ${SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label}`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-mono">
                  {selectedLang.split("-")[0]}
                </span>
              </button>

              {/* Language Menu Dropdown */}
              {showLangMenu && (
                <div className="absolute right-0 bottom-7 z-50 w-44 rounded-lg border bg-[var(--color-surface)] shadow-lg p-1 text-xs space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Voice Language
                  </div>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setSelectedLang(lang.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 transition ${
                        selectedLang === lang.code
                          ? "bg-[var(--color-primary)] text-white font-medium"
                          : "hover:bg-[var(--color-surface-elevated)] text-[var(--color-text)]"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Microphone Toggle Button */}
            <button
              onClick={toggleListening}
              type="button"
              className={`p-1.5 rounded-full transition-all ${
                isListening
                  ? "bg-red-600 text-white shadow-md animate-pulse scale-110"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
              }`}
              title={
                isListening
                  ? "Click to stop listening"
                  : `Voice Input (${SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label})`
              }
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
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
    </div>
  );
}
