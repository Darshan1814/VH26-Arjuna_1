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
