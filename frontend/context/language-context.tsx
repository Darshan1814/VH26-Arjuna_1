"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { usePathname } from "next/navigation";

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
  // --- Navigation & Core App Shell ---
  "Machine Troubleshooter",
  "Chatbot",
  "Process Flow",
  "What-If Simulator",
  "Image Analysis",
  "Voice Assistant",
  "Document Intelligence",
  "Doc & Video Intelligence",
  "Error Research",
  "Arjuna Sarthi",
  "Features & Tools",
  "Interactive troubleshooting",
  "AI Web Intelligence Extension",
  "Failure mode simulation",
  "OCR & visual error solving",
  "Multilingual voice AI (मराठी, हिंदी, English)",
  "IEEE papers & OEM service bulletins",
  "Doc roadmap & YouTube video cards",
  "Observable 8-stage pipeline",
  "Troubleshooter",
  "Industrial AI",
  "Industrial AI Diagnostic Platform",
  "Diagnostic System Online",
  "System Ready",
  "Collapse sidebar",
  "Expand sidebar",
  "Select Language",
  "Select Language (70 Available)",
  "Search 70 languages...",
  "No matching language found",
  "Translating...",
  "Language",
  "Indian Languages",
  "Global Languages",
  "Toggle dark/light theme",
  "Open navigation menu",
  "Clear conversation",
  "Clear",
  "Cancel",
  "Cancel / Change",
  "Run",
  "Step",
  "of 8",
  "Previous",
  "Next",
  "Next Step",
  "Re-run Step",
  "Executing Step",
  "Simulate",
  "Print",
  "Download PDF",
  "Download PDF Report",
  "View HTML Report",
  "View Interactive HTML Report",
  "Full Screen",
  "Report Unavailable",
  "Loading diagnostic report",
  "REPORT",
  "Diagnostic Report Preview",
  "Industrial Diagnostic Documentation",
  "Active Knowledge Base",
  "Universal OEM Diagnostic Engine",
  "Upload Manual",
  "Select & Upload Manual",
  "Upload Equipment Documentation",
  "Upload Service Manual or Schematic",
  "Upload Manual (Optional)",
  "Upload Service Manual",
  "Upload Another Manual",
  "Total Documents",
  "Detected Language",
  "Pipeline State",
  "Ingested & Verified",
  "Select File",

  // --- Chat Page ---
  "Industrial Diagnostic Assistant",
  "Industrial Machine Troubleshooting",
  "Industrial diagnostic reasoning engine with verified search citations. Inquire about any machine fault, alarm code, or physical symptom directly — or optionally upload an equipment manual to ground citations.",
  "Active Grounding Manual",
  "Quick Diagnostic Inquiries",
  "Describe the machine fault, alarm, or ask questions from uploaded manuals...",
  "Describe the machine issue or enter an error code...",
  "Listening... Your voice will transcribe here.",
  "Stop",
  "Voice Language",
  "Voice Input",
  "Click to stop listening",
  "Send message",
  "Analyzing technical documentation, logs & manuals...",
  "Diagnostic Finding:",
  "Mandatory Safety Precautions",
  "Ambiguity Detected — Please Specify Equipment:",
  "Insufficient Information",
  "Ranked Corrective Solutions",
  "Ranked by Evidence Strength",
  "Yellow-Highlighted Source Manual Evidence",
  "Source Citations",
  "HIGH Confidence",
  "MEDIUM Confidence",
  "LOW Confidence",
  "High confidence",
  "Medium confidence",
  "Low confidence",
  "confidence",
  "What does error E101 mean?",
  "Why is my CNC-X100 overheating?",
  "What does E101 mean on PRESS-Z200?",

  // --- What-If Simulator ---
  "Industrial \"What-If\" Failure Simulator",
  "Industrial “What-If” Failure Simulator",
  "AI Failure Mode & Effects Analysis (FMEA)",
  "Upload any equipment diagram, manual page (PDF/TXT), or panel photo. The system generates 10 high-impact failure scenarios, or test custom hypothetical faults with grounded OEM proof links.",
  "1. Input Equipment or Manual",
  "Machine Model / Equipment Type",
  "Upload image, manual page, or schematic",
  "PNG, JPG, PDF, or TXT formats supported",
  "Click to switch file",
  "Or paste specifications / technical excerpt:",
  "Paste operating parameters, pressure limits, or schematic notes...",
  "Generate 10 What-If Questions",
  "Extracting & Generating 10 Scenarios...",
  "Type Your Own Scenario (Direct Simulation)",
  "10 Failure Scenarios Generated",
  "Regenerate 10 Questions",
  "No questions generated yet",
  "Selected Failure Scenario:",
  "← Show All 10 Questions",
  "Simulate Scenario",
  "Simulating Physical Failure Dynamics & Sourcing OEM Bulletins...",
  "Simulation Verified",
  "Mandatory Safety & LOTO Protocol",
  "Engineering Diagnosis & Physical Cascade",
  "Root Causes & Triggers",
  "Step-by-Step Resolution Roadmap",
  "Ranked Engineering Solutions",
  "Live OEM Technical Bulletins & Proof References (Live Verified)",
  "Critical Risk",
  "High Impact",
  "Medium Impact",

  // --- Image Analysis ---
  "Vision & Optical Character Recognition (OCR)",
  "Image Analysis & Error Solving",
  "Upload machine alarm screen photos, indicator panels, digital gauge readouts, or damaged components. High-precision OCR extracts alphanumeric fault codes, and the system synthesizes comprehensive troubleshooting guidance backed by verified web proof links.",
  "1. Upload Machine Image",
  "Drop or click to upload photo",
  "Panel screens, error codes, LED alarms, gauges (PNG, JPG, WebP)",
  "Machine / Brand Hint (Optional)",
  "Observed Physical Symptoms (Optional)",
  "Analyze Image & Solve Fault",
  "Processing OCR & Diagnosing Error...",
  "Ready for Optical Character Recognition & Diagnosis",
  "Running Tesseract OCR & Sourcing OEM Service Bulletins...",
  "OCR & AI Verified",
  "OCR Extracted Text from Image",
  "Mandatory Lockout/Tagout (LOTO) & Electrical Safety",
  "Diagnostic Finding & Physical Root Mechanism",
  "Likely Causes",
  "Step-by-Step Resolution",
  "Ranked Countermeasures",
  "Live OEM Service Bulletins & Verified Proof Links",

  // --- Voice Assistant ---
  "Live Multilingual Voice AI",
  "Industrial Voice Troubleshooter",
  "Speak directly in Marathi (मराठी), Hindi (हिंदी), or English. No document upload required to start, or attach an OEM manual for grounded telemetry.",
  "Voice Model Playing",
  "Stop Audio",
  "Listen Voice",
  "Optional: Upload Machine Manual (PDF)",
  "Grounded in manual context",
  "Zero-upload conversational mode active",
  "Tap mic to start hands-free voice diagnostic",
  "1-Click Voice Test Prompts:",
  "Operator Voice Query",
  "AI Diagnostic Voice Model",
  "Actionable Resolution Steps:",
  "Verified OEM Proof Links:",
  "Type your query here or tap the mic above to speak...",

  // --- Document Intelligence ---
  "Document Intelligence & Video Learning Engine",
  "Document Breakdown & Video Guide Generator",
  "Upload any machine manual, schematic, or service bulletin. The system extracts core architecture, explains what the document actually covers, generates an actionable maintenance roadmap, and produces YouTube video tutorials and OEM reference cards via live search.",
  "Download B&W Intelligence Report",
  "Drop technical manual (PDF, TXT, DOCX) here",
  "Supports equipment user guides, wiring diagrams, and parts catalogs",
  "Optional: Focus Area or Symptoms Observed",
  "Analyze Document & Generate Guides",
  "Parsing Document & Querying Media Guides...",
  "Document Breakdown: What This Manual Actually Covers",
  "What To Do: Actionable Maintenance & Diagnostic Protocol",
  "Mandatory Action Items",
  "Safety & Precautions",
  "Recommended YouTube Video Walkthroughs",
  "OEM Service Manuals & Reference Cards",
  "No Document Uploaded Yet",

  // --- Error Research ---
  "OEM Bulletins & IEEE/ScienceDirect Research Engine",
  "Industrial Error & Failure Research",
  "Investigate any machine fault, alarm code, or physical degradation mode. Our engine surfaces peer-reviewed research papers, OEM technical service bulletins, and manufacturer application notes via verified search with forensic engineering synthesis.",
  "Download B&W Research Report",
  "Enter error code, machine symptom, or failure mode (e.g., Siemens V20 F001 Overcurrent)...",
  "Machine context (optional)",
  "Analyze Error",
  "Quick Inquiries:",
  "Executive Engineering Briefing",
  "Industry Consensus Standard",
  "Forensic Mechanism & Physics of Failure",
  "All Citations",
  "Research Papers",
  "OEM Bulletins",
  "Technical Documentation",
  "Read Publication",
  "Open OEM Bulletin",
  "View Manual",
  "No Error Searched Yet",

  // --- Arjuna Sarthi ---
  "Browser Extension • Chrome Manifest V3",
  "Your AI companion for understanding the web.",
  "Extract, synthesize, and interrogate any active webpage or document with grounded neural intelligence, precision retrieval, and zero hallucination.",
  "Download Extension (dist.zip)",
  "In-Page Simulator",
  "Installation Steps",
  "4-Layer Celestial Orbit Architecture",
  "Prithvi Core",
  "Gandiva Bow",
  "Tejas Shield",
  "Brahmastra Brain",
  "Live Reasoning Playground",
  "Chrome / Chromium Installation Guide",
  "AI Factual Response",
  "Page Grounding Citations",
  "Load Unpacked",
  "Enable Developer Mode",
  "Open Extensions",
  "Download or Build",

  // --- Process Flow Steps & Telemetry ---
  "Document Intake & Language Detection",
  "Multimodal Document Extraction & OCR",
  "Equipment & Technical Structure Extraction",
  "Semantic Chunking & Embedding Generation",
  "Database & pgvector Storage",
  "Diagnostic Index & Context Preparation",
  "Evidence Verification & Confidence Calibration",
  "User Query Verification & Grounded Diagnosis",
  "Ingestion",
  "Extraction",
  "Storage",
  "Retrieval",
  "Diagnosis",
  "Auto-Run (8 Steps)",
  "Pause Auto-Run",
  "Restart to Step 1",
  "Live Stage Telemetry",
  "Live Pipeline Telemetry",
  "Verified Output",
  "Session",
  "INITIALIZING",
  "Advanced Diagnostic Engine",
  "Industrial Diagnostic Process Flow",
  "Step-by-step observable RAG architecture executing live backend telemetry with zero simulated outputs",
  "Equipment Troubleshooting Query:",
  "Derived from Manual:",
  "Derived from Uploaded Manual:",
  "Uploaded Equipment Documents",
  "Pages Processed",
  "Tables Extracted",
  "Diagrams Detected",
  "OCR Processed",
  "Pages",
  "Extracted Document Sections:",
  "Section",
  "Page",
  "Equipment Identification Verdict:",
  "Operating Subsystems Identified:",
  "Mandatory Safety Precautions:",
  "Semantic Chunks",
  "Vector Dimension",
  "Embedding Model",
  "Indexed Semantic Chunk Excerpts:",
  "Dense",
  "Verify & Process Diagnostic Query",
  "Verifying & Processing Diagnostic Query...",
  "Stored in SQLite",
  "Technical Document Profile:",
  "Equipment Name:",
  "Document Type:",
  "Scope:",
  "Model Range:",
  "Electrical Spec:",
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

// Extend Node type for storing original English text
interface ExtTextNode extends Text {
  __origEnglish?: string;
  __translatedFor?: string;
}

// Global WeakMap so original English text survives across React renders and unmounts
const nodeEnglishMap = new WeakMap<Node, string>();

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentLanguage, setCurrentLanguageState] = useState<string>("en");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const registeredStringsRef = useRef<Set<string>>(new Set(INITIAL_CORE_STRINGS));
  const translationsRef = useRef<Record<string, string>>({});
  const reverseMapRef = useRef<Record<string, string>>({});
  const pendingBatchRef = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize translations ref and populate reverse translation map
  useEffect(() => {
    translationsRef.current = translations;
    Object.entries(translations).forEach(([eng, trans]) => {
      if (trans && trans !== eng) {
        reverseMapRef.current[trans.trim()] = eng.trim();
      }
    });
  }, [translations]);

  // Synchronous, foolproof restore to original English for the entire webpage
  const restoreAllEnglish = useCallback(() => {
    if (typeof window === "undefined") return;

    // 1. Walk every text node in document.body
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const extNode = node as ExtTextNode;
      const orig = nodeEnglishMap.get(extNode) || extNode.__origEnglish;
      if (orig) {
        if (extNode.nodeValue !== orig) {
          extNode.nodeValue = orig;
        }
        delete extNode.__translatedFor;
      } else if (extNode.nodeValue) {
        // Reverse dictionary lookup for any node that didn't have __origEnglish set
        const trimmed = extNode.nodeValue.trim();
        const reversed = reverseMapRef.current[trimmed];
        if (reversed) {
          extNode.nodeValue = extNode.nodeValue.replace(trimmed, reversed);
          extNode.__origEnglish = extNode.nodeValue;
          nodeEnglishMap.set(extNode, extNode.nodeValue);
          delete extNode.__translatedFor;
        }
      }
    }

    // 2. Restore all input / textarea placeholders
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[placeholder], textarea[placeholder]"
    );
    inputs.forEach((input) => {
      if (input.dataset.origPlaceholder) {
        input.placeholder = input.dataset.origPlaceholder;
      }
    });

    // 3. Restore all element titles (tooltips)
    const titled = document.querySelectorAll<HTMLElement>("[title]");
    titled.forEach((el) => {
      if (el.dataset.origTitle) {
        el.title = el.dataset.origTitle;
      }
    });
  }, []);

  // Load language from storage on initial mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("app_language");
      if (savedLang && SUPPORTED_LANGUAGES.some((l) => l.code === savedLang)) {
        setCurrentLanguageState(savedLang);
      }
    } catch {}
  }, []);

  // Flush queued strings to translate endpoint
  const flushTranslationBatch = useCallback(async (targetLang: string) => {
    if (targetLang === "en") return;
    const stringsToTranslate = Array.from(pendingBatchRef.current);
    pendingBatchRef.current.clear();

    if (stringsToTranslate.length === 0) return;

    setIsTranslating(true);
    const cacheKey = `trans_cache_${targetLang}`;
    let cachedMap: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cachedMap = JSON.parse(raw);
    } catch {}

    // Verify cache does not contain untranslated English strings
    const missing = stringsToTranslate.filter((s) => {
      const cached = cachedMap[s] || translationsRef.current[s];
      return !cached || cached.trim() === s.trim();
    });

    // Apply any valid cached translations immediately
    const immediateUpdates: Record<string, string> = {};
    stringsToTranslate.forEach((s) => {
      if (cachedMap[s] && cachedMap[s].trim() !== s.trim()) {
        immediateUpdates[s] = cachedMap[s];
        reverseMapRef.current[cachedMap[s].trim()] = s.trim();
      }
    });
    if (Object.keys(immediateUpdates).length > 0) {
      setTranslations((prev) => ({ ...prev, ...immediateUpdates }));
    }

    if (missing.length === 0) {
      setIsTranslating(false);
      return;
    }

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: missing,
          source: "en",
          target: targetLang,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translatedArray: string[] = Array.isArray(data.translated_text)
          ? data.translated_text
          : [data.translated_text];

        const newUpdates: Record<string, string> = {};
        missing.forEach((str, idx) => {
          const trans = translatedArray[idx];
          if (trans && trans.trim() && trans.trim() !== str.trim()) {
            newUpdates[str] = trans;
            cachedMap[str] = trans;
            reverseMapRef.current[trans.trim()] = str.trim();
          }
        });

        if (Object.keys(newUpdates).length > 0) {
          setTranslations((prev) => ({ ...prev, ...newUpdates }));
          try {
            localStorage.setItem(cacheKey, JSON.stringify(cachedMap));
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Translation API error:", err);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  // Queue text to be translated
  const queueForTranslation = useCallback(
    (text: string, targetLang: string) => {
      if (targetLang === "en" || !text.trim()) return;
      if (translationsRef.current[text] && translationsRef.current[text].trim() !== text.trim()) return;

      pendingBatchRef.current.add(text);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = setTimeout(() => {
        flushTranslationBatch(targetLang);
      }, 80);
    },
    [flushTranslationBatch]
  );

  // Switch Language
  const setLanguage = (code: string) => {
    if (code === currentLanguage) return;
    setCurrentLanguageState(code);
    try {
      localStorage.setItem("app_language", code);
    } catch {}

    if (code === "en") {
      setTranslations({});
      restoreAllEnglish();
      return;
    }

    // Load cached map for selected language
    const cacheKey = `trans_cache_${code}`;
    let cachedMap: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cachedMap = JSON.parse(raw);
    } catch {}

    // Populate reverse map from cache
    Object.entries(cachedMap).forEach(([eng, trans]) => {
      if (trans && trans !== eng) {
        reverseMapRef.current[trans.trim()] = eng.trim();
      }
    });

    setTranslations(cachedMap);

    // Queue all core strings
    const allCore = Array.from(registeredStringsRef.current);
    allCore.forEach((str) => {
      if (!cachedMap[str] || cachedMap[str].trim() === str.trim()) {
        pendingBatchRef.current.add(str);
      }
    });
    flushTranslationBatch(code);
  };

  // Initial load for non-en language
  useEffect(() => {
    if (currentLanguage !== "en") {
      const cacheKey = `trans_cache_${currentLanguage}`;
      let cachedMap: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) cachedMap = JSON.parse(raw);
      } catch {}
      setTranslations(cachedMap);

      const allCore = Array.from(registeredStringsRef.current);
      allCore.forEach((str) => {
        if (!cachedMap[str] || cachedMap[str].trim() === str.trim()) {
          pendingBatchRef.current.add(str);
        }
      });
      flushTranslationBatch(currentLanguage);
    } else {
      setTranslations({});
      restoreAllEnglish();
    }
  }, [currentLanguage, flushTranslationBatch, restoreAllEnglish]);

  // Translate helper for components
  const t = useCallback(
    (text: string, fallback?: string): string => {
      if (currentLanguage === "en" || !text) return text;
      const clean = text.trim();
      const translated = translations[clean] || translations[text];
      if (translated && translated.trim() !== clean) return translated;

      // Automatically queue missing text
      queueForTranslation(text, currentLanguage);
      return fallback || text;
    },
    [currentLanguage, translations, queueForTranslation]
  );

  const registerStrings = useCallback(
    (newStrings: string[]) => {
      newStrings.forEach((s) => {
        if (s && !registeredStringsRef.current.has(s)) {
          registeredStringsRef.current.add(s);
          if (currentLanguage !== "en" && !translationsRef.current[s]) {
            pendingBatchRef.current.add(s);
          }
        }
      });
      if (currentLanguage !== "en" && pendingBatchRef.current.size > 0) {
        if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = setTimeout(() => {
          flushTranslationBatch(currentLanguage);
        }, 80);
      }
    },
    [currentLanguage, flushTranslationBatch]
  );

  // =========================================================================
  // AUTOMATIC FULL-WEBPAGE DOM TEXT-NODE TRANSLATOR
  // =========================================================================
  const translateDomNodes = useCallback(() => {
    if (typeof window === "undefined") return;

    if (currentLanguage === "en") {
      restoreAllEnglish();
      return;
    }

    const isExcluded = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      if (
        tag === "script" ||
        tag === "style" ||
        tag === "code" ||
        tag === "pre" ||
        tag === "svg" ||
        tag === "path"
      ) {
        return true;
      }
      if (el.getAttribute("data-no-translate") === "true") return true;
      if (el.classList?.contains("no-translate")) return true;
      if (el.closest?.("[data-no-translate='true']")) return true;
      return false;
    };

    const hasLanguageLetters = (text: string) => {
      return /[a-zA-Z\u00C0-\uFFFF]/.test(text);
    };

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || isExcluded(parent)) return NodeFilter.FILTER_REJECT;
          const extNode = node as ExtTextNode;
          if (extNode.__origEnglish || nodeEnglishMap.has(extNode)) return NodeFilter.FILTER_ACCEPT;
          const val = node.nodeValue?.trim();
          if (!val || val.length < 2) return NodeFilter.FILTER_SKIP;
          if (!hasLanguageLetters(val)) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const extNode = node as ExtTextNode;
      const currentVal = extNode.nodeValue || "";

      // First encounter of this node: store original English
      if (!extNode.__origEnglish && !nodeEnglishMap.has(extNode)) {
        const trimmed = currentVal.trim();
        const knownEnglish = reverseMapRef.current[trimmed];
        const initialEnglish = knownEnglish ? currentVal.replace(trimmed, knownEnglish) : currentVal;
        extNode.__origEnglish = initialEnglish;
        nodeEnglishMap.set(extNode, initialEnglish);
      }

      const originalText = (extNode.__origEnglish || nodeEnglishMap.get(extNode) || currentVal).trim();
      if (!originalText) continue;

      // Skip if already translated for the currently active language
      if (extNode.__translatedFor === currentLanguage) continue;

      const translated =
        translationsRef.current[originalText] ||
        translationsRef.current[extNode.__origEnglish || ""];

      if (translated && translated.trim() !== originalText) {
        const template = extNode.__origEnglish || nodeEnglishMap.get(extNode) || currentVal;
        extNode.nodeValue = template.replace(originalText, translated);
        extNode.__translatedFor = currentLanguage;
        reverseMapRef.current[translated.trim()] = originalText;
      } else {
        // Queue for background translation
        queueForTranslation(originalText, currentLanguage);
      }
    }

    // Translate input & textarea placeholders
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[placeholder], textarea[placeholder]"
    );
    inputs.forEach((input) => {
      if (isExcluded(input)) return;
      if (!input.dataset.origPlaceholder) {
        const knownEng = reverseMapRef.current[input.placeholder.trim()];
        input.dataset.origPlaceholder = knownEng || input.placeholder;
      }
      const orig = input.dataset.origPlaceholder.trim();
      if (!orig || !hasLanguageLetters(orig)) return;

      if (translationsRef.current[orig] && translationsRef.current[orig].trim() !== orig) {
        input.placeholder = translationsRef.current[orig];
        reverseMapRef.current[translationsRef.current[orig].trim()] = orig;
      } else {
        queueForTranslation(orig, currentLanguage);
      }
    });

    // Translate element titles (tooltips)
    const titledElements = document.querySelectorAll<HTMLElement>("[title]");
    titledElements.forEach((el) => {
      if (isExcluded(el)) return;
      if (!el.dataset.origTitle) {
        const knownEng = reverseMapRef.current[el.title.trim()];
        el.dataset.origTitle = knownEng || el.title;
      }
      const orig = el.dataset.origTitle.trim();
      if (!orig || !hasLanguageLetters(orig)) return;

      if (translationsRef.current[orig] && translationsRef.current[orig].trim() !== orig) {
        el.title = translationsRef.current[orig];
        reverseMapRef.current[translationsRef.current[orig].trim()] = orig;
      } else {
        queueForTranslation(orig, currentLanguage);
      }
    });
  }, [currentLanguage, queueForTranslation, restoreAllEnglish]);

  // Main DOM translation observer & execution
  useEffect(() => {
    if (typeof window === "undefined") return;

    translateDomNodes();

    // Observe only added/removed child nodes
    const observer = new MutationObserver((mutations) => {
      let hasAddedNodes = false;
      for (const mut of mutations) {
        if (mut.type === "childList" && mut.addedNodes.length > 0) {
          hasAddedNodes = true;
          break;
        }
      }
      if (hasAddedNodes) {
        translateDomNodes();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
    });

    return () => {
      observer.disconnect();
    };
  }, [translateDomNodes, translations]);

  // Trigger on route change (Next.js client-side navigation)
  useEffect(() => {
    if (typeof window === "undefined" || currentLanguage === "en") return;

    translateDomNodes();
    const t1 = setTimeout(translateDomNodes, 60);
    const t2 = setTimeout(translateDomNodes, 250);
    const t3 = setTimeout(translateDomNodes, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, currentLanguage, translateDomNodes]);

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
