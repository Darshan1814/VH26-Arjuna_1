import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { PageStatusCard } from "./components/PageStatusCard";
import { ControlButtons } from "./components/ControlButtons";
import { ContentSummaryDrawer } from "./components/ContentSummaryDrawer";
import { ChatSection } from "./components/ChatSection";
import { SettingsModal } from "./components/SettingsModal";
import { buildPageChunks, selectRelevantChunks } from "./services/chunker";
import { askQuestion, checkBackendHealth } from "./services/api";
import { getPageState, savePageState, clearPageState } from "./services/storage";
import {
  ChatMessage,
  ContentChunk,
  ExtractedPage,
  FetchStep,
} from "./types";
import { AlertCircle, RefreshCw } from "lucide-react";

export const App: React.FC = () => {
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);

  const [fetchStep, setFetchStep] = useState<FetchStep>("idle");
  const [extractedPage, setExtractedPage] = useState<ExtractedPage | null>(null);
  const [chunks, setChunks] = useState<ContentChunk[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [activeModel, setActiveModel] = useState<string>("Neural Inference Engine");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Probe backend health
  const probeBackend = useCallback(async () => {
    const health = await checkBackendHealth();
    setBackendConnected(health.status === "connected");
    if (health.model) {
      setActiveModel(health.model);
    }
  }, []);

  // Initialize active tab and stored state
  const initializeTab = useCallback(async () => {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      setCurrentTitle("Local Browser Preview");
      setCurrentUrl("http://localhost:3000");
      return;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) {
        setErrorMessage("No active webpage detected in current window.");
        return;
      }

      setCurrentTabId(activeTab.id || null);
      setCurrentUrl(activeTab.url);
      setCurrentTitle(activeTab.title || activeTab.url);

      // Check if restricted browser page (chrome://, edge://, about:, chrome-extension://)
      if (
        activeTab.url.startsWith("chrome://") ||
        activeTab.url.startsWith("chrome-extension://") ||
        activeTab.url.startsWith("edge://") ||
        activeTab.url.startsWith("about:") ||
        activeTab.url.includes("chromewebstore.google.com")
      ) {
        setErrorMessage(
          "Arjuna Sarthi cannot run on browser internal pages or the Chrome Web Store. Please open any normal website (Wikipedia, GitHub, docs, blogs) to fetch."
        );
        return;
      }

      // Check storage for existing extracted state for this URL
      const saved = await getPageState(activeTab.url);
      if (saved && saved.page) {
        setExtractedPage(saved.page);
        setChunks(saved.chunks || []);
        setMessages(saved.messages || []);
        setFetchStep("ready");
      } else {
        setFetchStep("idle");
        setExtractedPage(null);
        setChunks([]);
        setMessages([]);
      }
    } catch (err: any) {
      console.error("Tab initialization error:", err);
      setErrorMessage("Could not detect active browser tab.");
    }
  }, []);

  useEffect(() => {
    probeBackend();
    initializeTab();
  }, [probeBackend, initializeTab]);

  // Handle FETCH action
  const handleFetch = async () => {
    setErrorMessage(null);

    if (
      !currentUrl ||
      currentUrl.startsWith("chrome://") ||
      currentUrl.startsWith("about:")
    ) {
      setErrorMessage("Please navigate to a standard webpage before clicking FETCH.");
      return;
    }

    if (!currentTabId) {
      setErrorMessage("Active tab ID not available.");
      return;
    }

    try {
      // Step 1: Detect and initiate
      setFetchStep("fetching");
      await new Promise((r) => setTimeout(r, 150));

      // Step 2: Ensure content script is present
      setFetchStep("extracting");
      let responded = false;
      try {
        const ping = await chrome.tabs.sendMessage(currentTabId, { action: "PING" });
        if (ping && ping.status === "ready") {
          responded = true;
        }
      } catch {
        responded = false;
      }

      // If content script was not already active on tab, inject it on demand
      if (!responded) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            files: ["content.js"],
          });
          await new Promise((r) => setTimeout(r, 200));
        } catch (injectErr: any) {
          throw new Error(
            `Unable to access webpage content: ${injectErr.message || "Permission restricted."}`
          );
        }
      }

      // Step 3: Extract structured page content
      const response = await chrome.tabs.sendMessage(currentTabId, {
        action: "EXTRACT_PAGE",
      });

      if (!response || !response.success || !response.data) {
        throw new Error(response?.error || "Content extraction failed on this page.");
      }

      const page: ExtractedPage = response.data;

      // Step 4: Cleaning & Structure
      setFetchStep("cleaning");
      await new Promise((r) => setTimeout(r, 150));

      // Step 5: Chunking & Searchable context
      setFetchStep("chunking");
      const generatedChunks = buildPageChunks(page);
      page.chunks = generatedChunks;

      setExtractedPage(page);
      setChunks(generatedChunks);
      setFetchStep("ready");

      // Save to chrome.storage.local
      await savePageState(currentUrl, page, generatedChunks, messages);
    } catch (err: any) {
      console.error("Fetch failure:", err);
      setFetchStep("failed");
      setErrorMessage(
        err.message || "Unable to fetch this page. The browser did not provide readable content."
      );
    }
  };

  // Handle CLEAR action
  const handleClear = async () => {
    if (currentUrl) {
      await clearPageState(currentUrl);
    }
    setExtractedPage(null);
    setChunks([]);
    setMessages([]);
    setFetchStep("idle");
    setErrorMessage(null);
  };

  // Handle asking questions
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || isAsking) return;

    if (!extractedPage || chunks.length === 0) {
      setErrorMessage("Please click FETCH first so Arjuna Sarthi can read the page content.");
      return;
    }

    setErrorMessage(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: queryText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsAsking(true);

    try {
      // 1. Select most relevant context chunks using keyword & heading relevance
      const relevantChunks = selectRelevantChunks(chunks, queryText, 6);

      // 2. Prepare conversation turns for context continuity
      const conversationTurns = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 3. Call backend API with strict grounding
      const res = await askQuestion({
        url: currentUrl,
        title: extractedPage.metadata.title,
        question: queryText.trim(),
        context: relevantChunks,
        conversation: conversationTurns,
      });

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sources: res.sources,
        grounded: res.grounded,
        model: res.model,
      };

      const updatedHistory = [...newHistory, assistantMsg];
      setMessages(updatedHistory);

      // Save updated conversation to storage
      await savePageState(currentUrl, extractedPage, chunks, updatedHistory);
    } catch (err: any) {
      console.error("Ask error:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          err.message ||
          "AI service unavailable. Please check the backend connection on http://localhost:8000.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        error: err.message,
      };
      setMessages([...newHistory, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[580px] max-h-[600px] sm:max-h-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans text-xs antialiased overflow-hidden select-none">
      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        backendConnected={backendConnected}
        activeModel={activeModel}
      />

      {/* Main Extension Scrollable Body */}
      <div className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs animate-fade-in">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-semibold block">Notification</span>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-1 text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Current Active Page Card */}
        <PageStatusCard
          currentUrl={currentUrl}
          currentTitle={currentTitle}
          extractedPage={extractedPage}
          fetchStep={fetchStep}
        />

        {/* Primary Page Processing Controls (FETCH & CLEAR) */}
        <ControlButtons
          onFetch={handleFetch}
          onClear={handleClear}
          fetchStep={fetchStep}
          hasExtractedContent={extractedPage !== null}
          disabled={!currentUrl}
        />

        {/* Fetched Content Hierarchy / Metadata Accordion */}
        {extractedPage && <ContentSummaryDrawer extractedPage={extractedPage} />}

        {/* Grounded Q&A Interface */}
        <ChatSection
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isAsking}
          disabled={fetchStep !== "ready"}
          isFetched={fetchStep === "ready"}
          currentUrl={currentUrl}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={probeBackend}
      />
    </div>
  );
};
