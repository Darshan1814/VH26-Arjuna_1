"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  countryCode: string;
  region: "Indian" | "Global";
}

// Exactly 15 Indian Languages + 55 Global Languages = 70 Total
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  // === 15 INDIAN LANGUAGES ===
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्", flag: "🇮🇳", countryCode: "in", region: "Indian" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", flag: "🇳🇵", countryCode: "np", region: "Indian" },
  { code: "kok", name: "Konkani", nativeName: "कोंकणी", flag: "🇮🇳", countryCode: "in", region: "Indian" },

  // === 55 GLOBAL LANGUAGES ===
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", countryCode: "us", region: "Global" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", countryCode: "es", region: "Global" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", countryCode: "fr", region: "Global" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", countryCode: "de", region: "Global" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", countryCode: "it", region: "Global" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", countryCode: "pt", region: "Global" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", countryCode: "ru", region: "Global" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", countryCode: "cn", region: "Global" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文", flag: "🇹🇼", countryCode: "tw", region: "Global" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", countryCode: "jp", region: "Global" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", countryCode: "kr", region: "Global" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", countryCode: "sa", region: "Global" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", countryCode: "nl", region: "Global" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", countryCode: "tr", region: "Global" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", countryCode: "pl", region: "Global" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪", countryCode: "se", region: "Global" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", countryCode: "id", region: "Global" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", countryCode: "vn", region: "Global" },
  { code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", countryCode: "th", region: "Global" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", countryCode: "gr", region: "Global" },
  { code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿", countryCode: "cz", region: "Global" },
  { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰", countryCode: "dk", region: "Global" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮", countryCode: "fi", region: "Global" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", countryCode: "no", region: "Global" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", countryCode: "hu", region: "Global" },
  { code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴", countryCode: "ro", region: "Global" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦", countryCode: "ua", region: "Global" },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", countryCode: "il", region: "Global" },
  { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", countryCode: "ir", region: "Global" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", countryCode: "my", region: "Global" },
  { code: "tl", name: "Filipino", nativeName: "Filipino", flag: "🇵🇭", countryCode: "ph", region: "Global" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰", countryCode: "sk", region: "Global" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬", countryCode: "bg", region: "Global" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷", countryCode: "hr", region: "Global" },
  { code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸", countryCode: "rs", region: "Global" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹", countryCode: "lt", region: "Global" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮", countryCode: "si", region: "Global" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻", countryCode: "lv", region: "Global" },
  { code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪", countryCode: "ee", region: "Global" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge", flag: "🇮🇪", countryCode: "ie", region: "Global" },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸", countryCode: "is", region: "Global" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪", countryCode: "ke", region: "Global" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", flag: "🇿🇦", countryCode: "za", region: "Global" },
  { code: "sq", name: "Albanian", nativeName: "Shqip", flag: "🇦🇱", countryCode: "al", region: "Global" },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն", flag: "🇦🇲", countryCode: "am", region: "Global" },
  { code: "az", name: "Azerbaijani", nativeName: "Azərbaycan", flag: "🇦🇿", countryCode: "az", region: "Global" },
  { code: "eu", name: "Basque", nativeName: "Euskara", flag: "🇪🇸", countryCode: "es", region: "Global" },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", flag: "🇧🇾", countryCode: "by", region: "Global" },
  { code: "bs", name: "Bosnian", nativeName: "Bosanski", flag: "🇧🇦", countryCode: "ba", region: "Global" },
  { code: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸", countryCode: "es", region: "Global" },
  { code: "ka", name: "Georgian", nativeName: "ქართული", flag: "🇬🇪", countryCode: "ge", region: "Global" },
  { code: "kk", name: "Kazakh", nativeName: "Қазақ", flag: "🇰🇿", countryCode: "kz", region: "Global" },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰", countryCode: "mk", region: "Global" },
  { code: "mn", name: "Mongolian", nativeName: "Монгол", flag: "🇲🇳", countryCode: "mn", region: "Global" },
  { code: "uz", name: "Uzbek", nativeName: "Oʻzbekcha", flag: "🇺🇿", countryCode: "uz", region: "Global" },
];

const INITIAL_CORE_STRINGS = [
  "Machine Troubleshooter",
  "Chatbot",
  "Process Flow",
  "Troubleshooting Assistant",
  "Ask about error codes, machine issues, or troubleshooting steps",
  "Clear conversation",
  "Type your question...",
  "Send",
  "What does error E101 mean?",
  "Why is my CNC-X100 overheating?",
  "What does E101 mean on PRESS-Z200?",
  "Get diagnostic help from service manuals. Ask about error codes, symptoms, or troubleshooting procedures.",
  "PDF Manuals",
  "Document Processing",
  "OCR / Layout Extraction",
  "Chunking",
  "Embeddings (BGE-M3)",
  "Hybrid Retrieval",
  "Reranking",
  "Evidence Verification",
  "Response Generation",
  "Citations & Highlights",
  "Language",
  "Select Language",
  "Search language...",
  "Translating...",
  "RAG Pipeline Architecture",
  "How the Machine Troubleshooter processes service manuals and generates cited troubleshooting answers using Retrieval-Augmented Generation.",
  "The pipeline enforces strict evidence-based answers. If retrieved evidence is insufficient, the system will not hallucinate — it will clearly state that it lacks information.",
  "Describe the machine issue or enter an error code...",
  "Voice input (coming soon)",
  "Send message",
];

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (code: string) => void;
  t: (text: string, fallback?: string) => string;
  isTranslating: boolean;
  registerStrings: (strings: string[]) => void;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguageState] = useState<string>("en");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const registeredStringsRef = useRef<Set<string>>(new Set(INITIAL_CORE_STRINGS));

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("app_language");
      if (savedLang && SUPPORTED_LANGUAGES.some((l) => l.code === savedLang)) {
        setCurrentLanguageState(savedLang);
      }
    } catch {}
  }, []);

  const translateRegisteredStrings = async (targetLang: string) => {
    if (targetLang === "en") {
      setTranslations({});
      return;
    }

    const cacheKey = `trans_cache_${targetLang}`;
    let cachedMap: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cachedMap = JSON.parse(raw);
    } catch {
      cachedMap = {};
    }

    const allStrings = Array.from(registeredStringsRef.current);
    const missingStrings = allStrings.filter((s) => !cachedMap[s]);

    if (missingStrings.length === 0) {
      setTranslations(cachedMap);
      return;
    }

    setTranslations((prev) => ({ ...prev, ...cachedMap }));
    setIsTranslating(true);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: missingStrings,
          source: "en",
          target: targetLang,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translatedArray: string[] = Array.isArray(data.translated_text)
          ? data.translated_text
          : [data.translated_text];

        const updatedMap = { ...cachedMap };
        missingStrings.forEach((str, idx) => {
          if (translatedArray[idx]) {
            updatedMap[str] = translatedArray[idx];
          }
        });

        setTranslations(updatedMap);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(updatedMap));
        } catch {}
      }
    } catch (err) {
      console.warn("Translation error:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  const registerStrings = useCallback((newStrings: string[]) => {
    let added = false;
    newStrings.forEach((s) => {
      if (s && !registeredStringsRef.current.has(s)) {
        registeredStringsRef.current.add(s);
        added = true;
      }
    });
    if (added && currentLanguage !== "en") {
      translateRegisteredStrings(currentLanguage);
    }
  }, [currentLanguage]);

  const setLanguage = (code: string) => {
    if (code === currentLanguage) return;
    setCurrentLanguageState(code);
    try {
      localStorage.setItem("app_language", code);
    } catch {}
    translateRegisteredStrings(code);
  };

  useEffect(() => {
    if (currentLanguage !== "en") {
      translateRegisteredStrings(currentLanguage);
    } else {
      setTranslations({});
    }
  }, [currentLanguage]);

  const t = useCallback(
    (text: string, fallback?: string): string => {
      if (currentLanguage === "en" || !text) return text;
      if (!registeredStringsRef.current.has(text)) {
        registeredStringsRef.current.add(text);
      }
      return translations[text] || fallback || text;
    },
    [currentLanguage, translations]
  );

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        t,
        isTranslating,
        registerStrings,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
