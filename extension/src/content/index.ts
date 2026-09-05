/**
 * Arjuna Sarthi - Intelligent In-Page Content Extractor.
 *
 * Runs inside the webpage DOM to perform structured, readability-style text extraction,
 * stripping boilerplate (navs, footers, cookie banners, ads) and formatting hierarchical sections.
 */

import { ExtractedPage, ExtractedSection, PageMetadata } from "../types";

// Elements to aggressively ignore as noise
const NOISE_SELECTORS = [
  "nav",
  "header:not(article header)",
  "footer",
  "aside",
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-modal="true"]',
  ".cookie-banner",
  ".cookie-consent",
  ".cookie-notice",
  "#onetrust-consent-sdk",
  "#cookie-banner",
  ".ad",
  ".ads",
  ".advertisement",
  ".adsbygoogle",
  ".social-share",
  ".share-buttons",
  ".comments",
  "#comments",
  ".sidebar",
  ".newsletter-signup",
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
];

function isVisible(elem: HTMLElement): boolean {
  if (!elem) return false;
  const style = window.getComputedStyle(elem);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = elem.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 || elem.getClientRects().length > 0;
}

function cleanText(text: string): string {
  return text
    .replace(/[\r\n]+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

function countWords(str: string): number {
  if (!str) return 0;
  const matches = str.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

function detectPdfOrDocViewer(): { isPdf: boolean; warning?: string } {
  const url = window.location.href.toLowerCase();
  const isPdfExtension = url.endsWith(".pdf") || url.includes(".pdf?") || url.includes("/pdf/");
  const hasEmbedPdf = Boolean(
    document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]')
  );
  const isPdfJs = Boolean(document.querySelector("#viewer.pdfViewer, .pdfViewer"));

  if (isPdfExtension || hasEmbedPdf) {
    if (isPdfJs) {
      // PDF.js text layer may be accessible
      const textLayers = document.querySelectorAll(".textLayer");
      if (textLayers.length > 0) {
        return { isPdf: true };
      }
    }
    return {
      isPdf: true,
      warning:
        "Content extraction is limited for this native document viewer. Text inside embedded canvas/PDF plugins may not be fully readable by DOM scripts.",
    };
  }

  return { isPdf: false };
}

function findPrimaryContentRoot(): HTMLElement {
  // Try high-confidence semantic selectors first
  const candidates = [
    "article",
    "main",
    '[role="main"]',
    "#content",
    ".content",
    ".post-content",
    ".article-content",
    ".documentation-content",
    ".markdown-body",
    "#mw-content-text", // Wikipedia
    ".wiki-content",
  ];

  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && isVisible(el) && el.innerText.trim().length > 200) {
      return el;
    }
  }

  return document.body;
}

export function extractPageContent(): ExtractedPage {
  const title = document.title.trim() || window.location.hostname;
  const url = window.location.href;
  const domain = window.location.hostname;

  const pdfCheck = detectPdfOrDocViewer();
  const root = findPrimaryContentRoot();

  // Clone to avoid modifying active document DOM
  const clone = root.cloneNode(true) as HTMLElement;

  // Remove boilerplate noise elements
  for (const sel of NOISE_SELECTORS) {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  }

  // Parse structured sections based on headings
  const sections: ExtractedSection[] = [];
  let currentSection: ExtractedSection = {
    id: "sec-intro",
    heading: "Overview",
    level: 1,
    content: "",
    wordCount: 0,
    subheadings: [],
  };

  const walker = document.createTreeWalker(
    clone,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node: Node | null = walker.currentNode;
  let accumulatedLines: string[] = [];

  const finalizeSection = () => {
    const rawSecText = cleanText(accumulatedLines.join("\n"));
    if (rawSecText.length > 30) {
      currentSection.content = rawSecText;
      currentSection.wordCount = countWords(rawSecText);
      sections.push({ ...currentSection });
    }
    accumulatedLines = [];
  };

  while ((node = walker.nextNode())) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Check for headings
    if (/^h[1-4]$/.test(tag)) {
      const headingText = cleanText(el.innerText);
      if (headingText && headingText.length < 150) {
        finalizeSection();
        const level = parseInt(tag[1], 10);
        currentSection = {
          id: `sec-${sections.length + 1}`,
          heading: headingText,
          level: level,
          content: "",
          wordCount: 0,
          subheadings: [],
        };
        continue;
      }
    }

    // Process Paragraphs
    if (tag === "p") {
      const pText = cleanText(el.innerText);
      if (pText && pText.length > 20) {
        accumulatedLines.push(pText);
      }
      continue;
    }

    // Process Lists
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.querySelectorAll("li"))
        .map((li) => cleanText(li.innerText))
        .filter((t) => t.length > 3)
        .map((t) => `• ${t}`);
      if (items.length > 0) {
        accumulatedLines.push(items.join("\n"));
      }
      continue;
    }

    // Process Code blocks
    if (tag === "pre") {
      const codeText = cleanText(el.innerText);
      if (codeText && codeText.length > 15) {
        accumulatedLines.push(`\`\`\`\n${codeText}\n\`\`\``);
      }
      continue;
    }

    // Process Tables
    if (tag === "table") {
      const rows = Array.from(el.querySelectorAll("tr"));
      if (rows.length > 0) {
        const tableLines: string[] = [];
        rows.slice(0, 20).forEach((row) => {
          const cells = Array.from(row.querySelectorAll("th, td")).map((c) =>
            cleanText(c.textContent || "")
          );
          if (cells.length > 0) {
            tableLines.push(`| ${cells.join(" | ")} |`);
          }
        });
        if (tableLines.length > 0) {
          accumulatedLines.push(tableLines.join("\n"));
        }
      }
      continue;
    }
  }

  // Finalize any remaining trailing section
  finalizeSection();

  // If no structured sections were captured, create one master section
  const entireCleanText = cleanText(clone.innerText || document.body.innerText);
  if (sections.length === 0 && entireCleanText.length > 20) {
    sections.push({
      id: "sec-1",
      heading: "Main Content",
      level: 1,
      content: entireCleanText,
      wordCount: countWords(entireCleanText),
    });
  }

  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0) || countWords(entireCleanText);

  const metadata: PageMetadata = {
    title,
    url,
    domain,
    fetchedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    wordCount: totalWords,
    sectionCount: sections.length,
    headingCount: sections.filter((s) => s.heading !== "Overview" && s.heading !== "Main Content").length,
    isPdfOrDoc: pdfCheck.isPdf,
    documentViewerWarning: pdfCheck.warning,
  };

  return {
    metadata,
    sections,
    cleanText: entireCleanText,
    chunks: [], // will be populated by chunker service
  };
}

  // Listen for messages from Arjuna Sarthi popup / sidepanel
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "PING") {
        sendResponse({ status: "ready" });
        return true;
      }

      if (message.action === "EXTRACT_PAGE") {
        try {
          const result = extractPageContent();
          sendResponse({ success: true, data: result });
        } catch (err: any) {
          sendResponse({
            success: false,
            error: err.message || "Failed to extract page content.",
          });
        }
        return true;
      }
    });
  }

/**
 * Injects a movable circular floating button onto any webpage.
 * - Circular orbit emblem matching page palette (warm bronze, slate, espresso).
 * - Draggable to any screen position.
 * - Clicking toggles an in-page companion overlay.
 */
function injectMovableFloatingWidget() {
  if (document.getElementById("arjuna-sarthi-floating-root")) return;

  const host = document.createElement("div");
  host.id = "arjuna-sarthi-floating-root";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647"; // maximum z-index
  host.style.right = "24px";
  host.style.bottom = "32px";
  host.style.width = "56px";
  host.style.height = "56px";
  host.style.userSelect = "none";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .arjuna-badge-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #231E19;
      border: 1.5px solid #3D332A;
      box-shadow: 0 8px 24px rgba(26, 22, 19, 0.4);
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      touch-action: none;
    }
    .arjuna-badge-btn:hover {
      transform: scale(1.06);
      box-shadow: 0 10px 28px rgba(181, 144, 106, 0.35);
    }
    .arjuna-badge-btn:active {
      cursor: grabbing;
      transform: scale(0.96);
    }
    .status-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #4E9A75;
      border: 2px solid #231E19;
    }
    /* Companion Popup Panel */
    .arjuna-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 360px;
      max-height: 540px;
      background: #1A1613;
      color: #F2EDE5;
      border: 1.5px solid #3D332A;
      border-radius: 20px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483646;
    }
    .arjuna-panel.open {
      display: flex;
      animation: fadeIn 0.18s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .panel-header {
      padding: 12px 16px;
      background: #231E19;
      border-bottom: 1px solid #3D332A;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel-title {
      font-size: 13px;
      font-weight: 700;
      color: #F2EDE5;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-close {
      background: none;
      border: none;
      color: #8E7F72;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      border-radius: 6px;
    }
    .panel-close:hover {
      color: #F2EDE5;
      background: #3D332A;
    }
    .panel-body {
      padding: 14px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 12px;
      line-height: 1.5;
      color: #C7B9AC;
    }
    .action-btn {
      background: #B5906A;
      color: #1A1613;
      font-weight: 700;
      padding: 9px 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      transition: background 0.15s;
    }
    .action-btn:hover { background: #D9C2AA; }
    .chat-input-row {
      padding: 10px;
      background: #231E19;
      border-top: 1px solid #3D332A;
      display: flex;
      gap: 8px;
    }
    .chat-input {
      flex: 1;
      background: #1A1613;
      border: 1px solid #3D332A;
      border-radius: 10px;
      color: #F2EDE5;
      padding: 8px 12px;
      font-size: 12px;
      outline: none;
    }
    .chat-input:focus { border-color: #B5906A; }
    .send-btn {
      background: #B5906A;
      border: none;
      color: #1A1613;
      padding: 0 14px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }
    .citation-tag {
      background: #2D2620;
      border: 1px solid #3D332A;
      color: #B5906A;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      display: inline-block;
    }
  `;

  // SVG Circular Emblem with matching Bronze / Slate palette
  const svgMarkup = `
    <svg viewBox="0 0 120 120" width="38" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b-bronze" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#D9C2AA" />
          <stop offset="100%" stop-color="#785A3C" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" stroke="#728A9E" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.6"/>
      <ellipse cx="60" cy="60" rx="44" ry="18" transform="rotate(25 60 60)" stroke="#A38465" stroke-width="1.3" opacity="0.75"/>
      <ellipse cx="60" cy="60" rx="30" ry="12" transform="rotate(-15 60 60)" stroke="url(#b-bronze)" stroke-width="1.5"/>
      <path d="M60 26 L32 90" stroke="url(#b-bronze)" stroke-width="8" stroke-linecap="round"/>
      <path d="M60 26 L88 90" stroke="url(#b-bronze)" stroke-width="8" stroke-linecap="round"/>
      <line x1="44" y1="67" x2="76" y2="67" stroke="#728A9E" stroke-width="5" stroke-linecap="round"/>
      <circle cx="60" cy="67" r="3.5" fill="#F2EDE5"/>
      <circle cx="60" cy="26" r="3.5" fill="#F2EDE5"/>
    </svg>
  `;

  const btn = document.createElement("div");
  btn.className = "arjuna-badge-btn";
  btn.title = "Arjuna Sarthi (Drag to move, click to open)";
  btn.innerHTML = `${svgMarkup}<div class="status-dot"></div>`;

  const panel = document.createElement("div");
  panel.className = "arjuna-panel";
  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        ${svgMarkup}
        <span>Arjuna Sarthi AI</span>
      </div>
      <button class="panel-close" title="Close panel">&times;</button>
    </div>
    <div class="panel-body">
      <div style="background: #231E19; padding: 10px; border-radius: 10px; border: 1px solid #3D332A;">
        <span style="color: #B5906A; font-weight: 600;">Active Page Companion</span>
        <p style="margin-top: 4px; font-size: 11px;">Extract and query this webpage with grounded AI intelligence.</p>
      </div>
      <button class="action-btn" id="fetch-page-btn">
        <span>⚡ Fetch Page Content</span>
      </button>
      <div id="panel-chat-messages" style="display: flex; flex-direction: column; gap: 8px;"></div>
    </div>
    <div class="chat-input-row">
      <input type="text" class="chat-input" id="panel-input" placeholder="Ask anything about this page..." />
      <button class="send-btn" id="panel-send">Ask</button>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(btn);
  document.body.appendChild(host);

  // Dragging logic
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;
  let hasMoved = false;

  const onStart = (clientX: number, clientY: number) => {
    isDragging = true;
    hasMoved = false;
    startX = clientX;
    startY = clientY;
    const rect = host.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    if (Math.hypot(deltaX, deltaY) > 5) {
      hasMoved = true;
    }
    const newLeft = Math.min(Math.max(10, initLeft + deltaX), window.innerWidth - 66);
    const newTop = Math.min(Math.max(10, initTop + deltaY), window.innerHeight - 66);
    host.style.left = `${newLeft}px`;
    host.style.top = `${newTop}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
  };

  const onEnd = () => {
    isDragging = false;
  };

  btn.addEventListener("mousedown", (e) => onStart(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onEnd);

  btn.addEventListener("touchstart", (e) => {
    if (e.touches[0]) onStart(e.touches[0].clientX, e.touches[0].clientY);
  });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  });
  window.addEventListener("touchend", onEnd);

  // Toggle Panel on Click
  btn.addEventListener("click", () => {
    if (hasMoved) return;
    panel.classList.toggle("open");
  });

  const closeBtn = panel.querySelector(".panel-close");
  closeBtn?.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // Handle in-page Fetch & Ask
  const fetchBtn = panel.querySelector("#fetch-page-btn");
  const msgContainer = panel.querySelector("#panel-chat-messages");
  const inputEl = panel.querySelector("#panel-input") as HTMLInputElement;
  const sendBtn = panel.querySelector("#panel-send");

  let extractedData: ExtractedPage | null = null;

  fetchBtn?.addEventListener("click", () => {
    try {
      extractedData = extractPageContent();
      fetchBtn.innerHTML = `<span>✓ Fetched (${extractedData.sections.length} sections)</span>`;
      (fetchBtn as HTMLElement).style.background = "#2C7A53";
      (fetchBtn as HTMLElement).style.color = "#FFFFFF";
    } catch {
      fetchBtn.innerHTML = `<span>Error fetching</span>`;
    }
  });

  const handleSend = async () => {
    const q = inputEl?.value?.trim();
    if (!q) return;
    inputEl.value = "";

    const userMsg = document.createElement("div");
    userMsg.style.cssText = "background: #2D2620; padding: 8px 10px; border-radius: 10px; align-self: flex-end; color: #F2EDE5;";
    userMsg.textContent = q;
    msgContainer?.appendChild(userMsg);

    const loadingMsg = document.createElement("div");
    loadingMsg.style.cssText = "background: #231E19; padding: 8px 10px; border-radius: 10px; align-self: flex-start; color: #B5906A; font-style: italic;";
    loadingMsg.textContent = "Reasoning with AI...";
    msgContainer?.appendChild(loadingMsg);

    try {
      if (!extractedData) {
        extractedData = extractPageContent();
      }

      const res = await fetch("http://localhost:8000/api/extension/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: window.location.href,
          title: document.title,
          question: q,
          context: extractedData.sections.slice(0, 4).map((s) => ({
            id: s.id,
            heading: s.heading,
            content: s.content.slice(0, 1000),
            url: window.location.href,
          })),
          conversation: [],
        }),
      });

      loadingMsg.remove();

      if (res.ok) {
        const json = await res.json();
        const botMsg = document.createElement("div");
        botMsg.style.cssText = "background: #231E19; border: 1px solid #3D332A; padding: 10px; border-radius: 10px; align-self: flex-start; color: #F2EDE5; line-height: 1.5;";
        botMsg.innerHTML = `<div style="font-weight: 700; color: #B5906A; margin-bottom: 4px;">Arjuna Sarthi</div><div>${json.answer}</div>`;
        msgContainer?.appendChild(botMsg);
      } else {
        const errMsg = document.createElement("div");
        errMsg.style.cssText = "color: #DE5B5B; font-size: 11px;";
        errMsg.textContent = "Could not query AI backend (verify localhost:8000).";
        msgContainer?.appendChild(errMsg);
      }
    } catch {
      loadingMsg.remove();
      const errMsg = document.createElement("div");
      errMsg.style.cssText = "color: #DE5B5B; font-size: 11px;";
      errMsg.textContent = "Backend offline or connection error.";
      msgContainer?.appendChild(errMsg);
    }
  };

  sendBtn?.addEventListener("click", handleSend);
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

// Auto-inject on DOM readiness
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectMovableFloatingWidget);
  } else {
    injectMovableFloatingWidget();
  }
}

