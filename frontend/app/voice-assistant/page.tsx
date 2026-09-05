/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Globe,
  Radio,
  X,
  Play,
  Pause,
  RotateCcw,
  Headphones,
  Music,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { getApiBase } from "@/lib/api";

interface VoiceMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  spokenText?: string;
  audioUrl?: string;
  language?: string;
  problem?: string;
  actionSteps?: string[];
  safetyWarning?: string;
  proofLinks?: { title: string; link: string; snippet?: string; source?: string }[];
  timestamp: string;
}

const QUICK_VOICE_PROMPTS = [
  { label: "मराठी: सीमेंस V20 F001 एरर", query: "सीमेंस व्ही२० एफ००१ एरर का येतो आणि काय उपाय आहे?", lang: "mr" },
  { label: "मराठी: रोबोट आर्म बॅकलॅश", query: "रोबोट आर्ममधील हार्मोनिक ड्राईव्ह बॅकलॅश कसा दुरुस्त करावा?", lang: "mr" },
  { label: "हिंदी: फैनुक सर्वो 401 अलार्म", query: "फैनुक सर्वो एम्पलीफायर ४०१ अलार्म कैसे ठीक करें?", lang: "hi" },
  { label: "English: Spindle Overheat E101", query: "Spindle motor overheating E101 troubleshooting checklist", lang: "en" },
];

export default function VoiceAssistantPage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Client hydration check
  const [mounted, setMounted] = useState<boolean>(false);

  // Language settings: mr (Marathi), hi (Hindi), en (English)
  const [selectedLang, setSelectedLang] = useState<string>("mr");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Manual document upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hasDocContext, setHasDocContext] = useState<boolean>(false);

  // Conversation history
  const [messages, setMessages] = useState<VoiceMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "नमस्कार! मी तुमचा इंडस्ट्रियल AI व्हॉइस असिस्टंट आहे. तुमच्या मशीनच्या समस्येबद्दल मराठी, हिंदी किंवा इंग्रजीत बोला — कोणतेही मॅन्युअल अपलोड न करता थेट संभाषण सुरू करू शकता, किंवा अधिक माहितीसाठी मॅन्युअल पीडीएफ अपलोड करू शकता.",
      spokenText: "नमस्कार! मी तुमचा इंडस्ट्रियल AI व्हॉइस असिस्टंट आहे. बोला, मी कशी मदत करू?",
      audioUrl: `${getApiBase()}/api/voice/tts?lang=mr&text=%E0%A4%A8%E0%A4%AE%E0%A4%B8%E0%A5%8D%E0%A4%95%E0%A4%BE%E0%A4%B0!%20%E0%A4%AE%E0%A5%80%20%E0%A4%A4%E0%A5%81%E0%A4%AE%E0%A4%9 outcome%E0%A4%BE%20%E0%A4%87%E0%A4%82%E0%A4%A1%E0%A4%B8%E0%A5%8D%E0%A4%9F%E0%A5%8D%E0%A4%B0%E0%A4%BF%E0%A4%AF%E0%A4%B2%20%E0%A4%8F%E0%A4%86%E0%A4%AF%20%E0%A4%B5%E0%A5%8D%E0%A4%B9%E0%A5%89%E0%A4%87%E0%A4%B8%20%E0%A4%85%E0%A4%B8%E0%A4%BF%E0%A4%B8%E0%A5%8D%E0%A4%9F%E0%A4%82%E0%A4%9F%20%E0%A4%86%E0%A4%B9%E0%A5%87.%20%E0%A4%AC%E0%A5%8B%E0%A4%B2%E0%A4%BE%2C%20%E0%A4%AE%E0%A5%80%20%E0%A4%95%E0%A4%B6%E0%A5%80%20%E0%A4%AE%E0%A4%A6%E0%A4%A4%20%E0%A4%95%E0%A4%B0%E0%A5%82%3F`,
      language: "mr",
      problem: "मल्टीलिंग्युअल व्हॉइस असिस्टंट तयार (Marathi, Hindi & English)",
      actionSteps: [
        "माइक बटण दाबा आणि मशीनचा फॉल्ट किंवा एरर कोड बोला",
        "मराठी किंवा हिंदीमध्ये विचारल्यास मॉडेल त्याच भाषेत स्पष्ट आवाजात उत्तर देईल",
        "खालील क्विक प्रॉम्टवर क्लिक करून लगेच व्हॉइस टेस्ट करा",
      ],
      safetyWarning: "सुरक्षा सूचना: मशीन तपासण्यापूर्वी नेहमी LOTO (Lockout/Tagout) नियमांचे पालन करा.",
      timestamp: "10:00 AM",
    },
  ]);

  const [inputQuery, setInputQuery] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Speech Recognition instance ref
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        const langMap: Record<string, string> = {
          mr: "mr-IN",
          hi: "hi-IN",
          en: "en-IN",
          auto: "mr-IN",
        };
        recognition.lang = langMap[selectedLang] || "mr-IN";

        recognition.onstart = () => {
          setIsListening(true);
          setErrorMessage(null);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            handleSendVoiceQuery(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error !== "no-speech") {
            setErrorMessage(`Microphone status: ${event.error}. You can also type or use quick prompts below.`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      stopVoiceAudio();
    };
  }, [selectedLang]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Stop currently playing audio or speech
  const stopVoiceAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  };

  // Browser SpeechSynthesis fallback
  const speakTextFallback = (text: string, langCode: string = "mr") => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      mr: "mr-IN",
      hi: "hi-IN",
      en: "en-US",
    };
    utterance.lang = langMap[langCode] || "mr-IN";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // High-fidelity Audio Streaming Player (with automatic browser fallback)
  const playVoiceAudio = (
    audioUrl?: string,
    fallbackText?: string,
    langCode: string = "mr",
    messageId?: string
  ) => {
    stopVoiceAudio();

    if (messageId) {
      setSpeakingMessageId(messageId);
    }

    if (audioUrl) {
      try {
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;

        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        };
        audio.onerror = (err) => {
          console.warn("Audio element error, using speech synthesis fallback:", err);
          if (fallbackText) {
            speakTextFallback(fallbackText, langCode);
          } else {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          }
        };

        audio.play().catch((playErr) => {
          console.warn("Audio autoplay blocked by browser policy, using fallback:", playErr);
          if (fallbackText) {
            speakTextFallback(fallbackText, langCode);
          } else {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          }
        });
      } catch (e) {
        if (fallbackText) {
          speakTextFallback(fallbackText, langCode);
        }
      }
    } else if (fallbackText) {
      speakTextFallback(fallbackText, langCode);
    }
  };

  // Toggle voice recognition
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      stopVoiceAudio();
      try {
        const langMap: Record<string, string> = {
          mr: "mr-IN",
          hi: "hi-IN",
          en: "en-IN",
          auto: "mr-IN",
        };
        if (recognitionRef.current) {
          recognitionRef.current.lang = langMap[selectedLang] || "mr-IN";
          recognitionRef.current.start();
        } else {
          setErrorMessage("Speech recognition is not supported in this browser. Please type or use quick prompts.");
        }
      } catch (err: any) {
        console.warn("Start recognition err:", err);
        setIsListening(false);
      }
    }
  };

  // Handle Query Submission
  const handleSendVoiceQuery = async (queryText: string, langOverride?: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    const currentLang = langOverride || selectedLang;
    const nowTime = mounted
      ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "10:00 AM";

    const userMsg: VoiceMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: cleanQuery,
      timestamp: nowTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("query", cleanQuery);
      formData.append("language", currentLang);
      if (uploadedFile) {
        formData.append("file", uploadedFile);
      }

      const res = await fetch(`${getApiBase()}/api/voice/chat`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Voice server responded with status: ${res.statusText}`);
      }

      const data = await res.json();
      setHasDocContext(Boolean(data.has_document_context));

      const finalAudioUrl = data.audio_url
        ? (data.audio_url.startsWith("http") ? data.audio_url : `${getApiBase()}${data.audio_url}`)
        : undefined;

      const newMsgId = `ast-${Date.now()}`;
      const assistantMsg: VoiceMessage = {
        id: newMsgId,
        sender: "assistant",
        text: data.display_text,
        spokenText: data.spoken_text,
        audioUrl: finalAudioUrl,
        language: data.detected_language,
        problem: data.problem,
        actionSteps: data.action_steps,
        safetyWarning: data.safety_warning,
        proofLinks: data.proof_links,
        timestamp: mounted
          ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "10:00 AM",
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically play high-fidelity spoken response
      playVoiceAudio(
        finalAudioUrl,
        data.spoken_text,
        data.detected_language || currentLang,
        newMsgId
      );
    } catch (err: any) {
      console.error("Voice chat error:", err);
      setErrorMessage(err.message || "Failed to process voice query.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return (
      <div className="w-full flex-1 py-12 px-4 flex items-center justify-center">
        <div className="flex items-center gap-3 p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-sm text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
          <span className="font-semibold">Loading Voice AI Troubleshooter...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        {/* Header Bar */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                {t("Live Multilingual Voice AI")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                {t("Industrial Voice Troubleshooter")}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("Speak directly in Marathi (मराठी), Hindi (हिंदी), or English. No document upload required to start, or attach an OEM manual for grounded telemetry.")}
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface)] p-1.5 rounded-xl border border-[var(--color-border)]">
              <button
                onClick={() => {
                  setSelectedLang("mr");
                  stopVoiceAudio();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedLang === "mr"
                    ? "bg-[var(--color-primary)] text-white shadow-xs"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                मराठी (Marathi)
              </button>
              <button
                onClick={() => {
                  setSelectedLang("hi");
                  stopVoiceAudio();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedLang === "hi"
                    ? "bg-[var(--color-primary)] text-white shadow-xs"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                हिंदी (Hindi)
              </button>
              <button
                onClick={() => {
                  setSelectedLang("en");
                  stopVoiceAudio();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedLang === "en"
                    ? "bg-[var(--color-primary)] text-white shadow-xs"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Active Speaking Status Bar */}
          {isSpeaking && (
            <div className="mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-4 bg-emerald-600 rounded-full animate-pulse" />
                  <span className="w-1.5 h-6 bg-emerald-500 rounded-full animate-bounce" />
                  <span className="w-1.5 h-3 bg-emerald-600 rounded-full animate-pulse" />
                </div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {t("Voice Model Playing")} ({selectedLang === "mr" ? "मराठी आवाज" : selectedLang === "hi" ? "हिंदी आवाज़" : "English Speech"})
                </span>
              </div>
              <button
                onClick={stopVoiceAudio}
                className="px-3 py-1 rounded-lg bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 text-xs font-bold hover:bg-emerald-300 transition flex items-center gap-1"
              >
                <VolumeX className="h-3.5 w-3.5" />
                <span>{t("Stop Audio")}</span>
              </button>
            </div>
          )}

          {/* Optional PDF Upload Context Bar */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadedFile(e.target.files[0]);
                  }
                }}
                accept=".pdf,.txt,.docx"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)] transition"
              >
                <Upload className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                <span>{uploadedFile ? uploadedFile.name : t("Optional: Upload Machine Manual (PDF)")}</span>
              </button>

              {uploadedFile && (
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-red-500 transition"
                  title="Remove manual"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <span className="text-xs text-[var(--color-text-muted)]">
              {uploadedFile
                ? t("Grounded in manual context")
                : t("Zero-upload conversational mode active")}
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Big Interactive Mic Action Card */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface-elevated)] to-[var(--color-surface)] p-8 text-center shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              {isListening && (
                <div className="absolute -inset-4 rounded-full bg-red-500/20 animate-ping" />
              )}
              {isSpeaking && (
                <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-pulse" />
              )}

              <button
                type="button"
                onClick={toggleListening}
                className={`relative h-24 w-24 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 cursor-pointer ${
                  isListening
                    ? "bg-red-600 text-white scale-110 ring-4 ring-red-300"
                    : isSpeaking
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-300"
                    : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white hover:scale-105"
                }`}
                title="Click to speak or stop"
              >
                {isListening ? (
                  <MicOff className="h-10 w-10 animate-pulse" />
                ) : isSpeaking ? (
                  <Volume2 className="h-10 w-10 animate-bounce" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-base font-bold text-[var(--color-text)]">
                {isListening
                  ? selectedLang === "mr"
                    ? "आम्ही ऐकत आहोत... मशीनचा प्रॉब्लेम बोला"
                    : selectedLang === "hi"
                    ? "हम सुन रहे हैं... मशीन की समस्या बताएं"
                    : "Listening... Speak your machine symptom"
                  : isSpeaking
                  ? selectedLang === "mr"
                    ? "व्हॉइस मॉडेल मराठीत बोलत आहे..."
                    : selectedLang === "hi"
                    ? "वॉइस मॉडल हिंदी में बोल रहा है..."
                    : "Voice model speaking..."
                  : selectedLang === "mr"
                  ? "माइकवर क्लिक करा आणि मराठीत बोला"
                  : selectedLang === "hi"
                  ? "माइक पर क्लिक करें और हिंदी में बोलें"
                  : "Tap mic to start hands-free voice diagnostic"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {selectedLang === "mr"
                  ? "उदा. 'सीमेंस व्ही२० एफ००१ एरर का येतो आणि काय उपाय आहे?'"
                  : selectedLang === "hi"
                  ? "उदा. 'फैनुक सर्वो अलार्म ४०१ कैसे ठीक करें?'"
                  : "e.g. 'Why does Siemens V20 trigger F001 and what should I inspect?'"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Voice Prompt Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              {t("1-Click Voice Test Prompts:")}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {t("Click any chip to test instant speech & audio output")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_VOICE_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedLang(qp.lang);
                  handleSendVoiceQuery(qp.query, qp.lang);
                }}
                className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-xs font-medium text-[var(--color-text)] transition flex items-center gap-1.5 shadow-2xs"
              >
                <Headphones className="h-3 w-3 text-[var(--color-primary)]" />
                <span>{qp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Message Stream */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-6 shadow-sm">
          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {msg.sender === "user" ? (
                  <div className="max-w-3xl rounded-2xl bg-[var(--color-primary)] text-white p-4 shadow-xs space-y-1">
                    <div className="flex items-center justify-between gap-4 text-white/70 text-[11px]">
                      <span className="font-semibold">{t("Operator Voice Query")}</span>
                      <span suppressHydrationWarning>{msg.timestamp}</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                  </div>
                ) : (
                  <div className="w-full max-w-4xl xl:max-w-5xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                          <Radio className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[var(--color-text)]">
                            {t("AI Diagnostic Voice Model")}
                          </h4>
                          <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase">
                            Lang: {msg.language || "mr"} • Neural Speech AI
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSpeaking && speakingMessageId === msg.id) {
                              stopVoiceAudio();
                            } else {
                              playVoiceAudio(
                                msg.audioUrl,
                                msg.spokenText || msg.text,
                                msg.language || selectedLang,
                                msg.id
                              );
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                            isSpeaking && speakingMessageId === msg.id
                              ? "bg-red-600 text-white"
                              : "bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                          }`}
                        >
                          {isSpeaking && speakingMessageId === msg.id ? (
                            <>
                              <VolumeX className="h-3.5 w-3.5 text-white" />
                              <span>{t("Stop Voice")}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                              <span>{t("Listen Voice")}</span>
                            </>
                          )}
                        </button>
                        <span suppressHydrationWarning className="text-[10px] text-[var(--color-text-muted)]">{msg.timestamp}</span>
                      </div>
                    </div>

                    {/* Problem Title */}
                    {msg.problem && (
                      <h3 className="text-base font-bold text-[var(--color-text)] leading-snug">
                        {msg.problem}
                      </h3>
                    )}

                    {/* Spoken Audio Transcript Quote */}
                    {msg.spokenText && (
                      <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3.5 flex items-start gap-2.5">
                        <Volume2 className="h-4 w-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                        <p className="text-xs font-medium text-[var(--color-text)] italic leading-relaxed">
                          &ldquo;{msg.spokenText}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Safety Warning */}
                    {msg.safetyWarning && (
                      <div className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-900 dark:text-red-300 flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <span className="font-semibold">{msg.safetyWarning}</span>
                      </div>
                    )}

                    {/* Action Steps */}
                    {msg.actionSteps && msg.actionSteps.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                          {t("Actionable Resolution Steps:")}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.actionSteps.map((step, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 text-xs text-[var(--color-text)] flex items-start gap-2"
                            >
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="leading-relaxed font-medium">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Proof Links */}
                    {msg.proofLinks && msg.proofLinks.length > 0 && (
                      <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1">
                          <Globe className="h-3 w-3 text-blue-500" />
                          {t("Verified OEM Proof Links:")}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.proofLinks.map((pl, pIdx) => (
                            <a
                              key={pIdx}
                              href={pl.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2 text-xs text-[var(--color-text)] hover:border-[var(--color-primary)] transition truncate"
                            >
                              <span className="truncate pr-2 font-medium">{pl.title}</span>
                              <ExternalLink className="h-3 w-3 text-[var(--color-text-muted)] flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 flex items-center gap-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
                  <span className="text-xs font-semibold text-[var(--color-text)]">
                    {t("Analyzing technical documentation, logs & manuals...")}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* Text Input Fallback Bar */}
        <div className="sticky bottom-4 z-20 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 shadow-lg backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendVoiceQuery(inputQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={
                selectedLang === "mr"
                  ? "येथे टाइप करा किंवा वरील माइक बटण वापरून मराठीत बोला..."
                  : selectedLang === "hi"
                  ? "यहाँ टाइप करें या ऊपर माइक बटन से हिंदी में बोलें..."
                  : t("Type your query here or tap the mic above to speak...")
              }
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                isListening
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
              }`}
              title={isListening ? "Stop listening" : "Speak into microphone"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="submit"
              disabled={isProcessing || !inputQuery.trim()}
              className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {t("Send")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
