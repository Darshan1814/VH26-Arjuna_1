# Arjuna Sarthi (अर्जुन सारथी)
> **"Your AI companion for understanding the web."**
> Subtitle: *AI Web Intelligence*

Arjuna Sarthi is a high-precision, Chrome Manifest V3 browser extension built with React, TypeScript, and Tailwind CSS. It empowers operators, engineers, researchers, and students to navigate and deeply understand complex web documentation, technical manuals, Wikipedia entries, articles, and research pages. With a single click of **FETCH**, Arjuna Sarthi extracts visible structure and grounds all questions strictly in the fetched webpage using the ultra-fast Groq LLM inference engine.

---

## Architecture Overview

```
Active Browser Tab (Wikipedia, Docs, Manuals, Articles)
           │
           ▼ [FETCH clicked]
Content Script (`content.js`)
           │  • Extracts Title, URL, Headings (H1–H4), Paragraphs, Lists, Tables, Code
           │  • Aggressively strips boilerplate (nav, footer, cookie banners, modal ads)
           │  • Normalizes whitespace & computes real statistics (word, section count)
           ▼
RAG Chunking Engine (`src/services/chunker.ts`)
           │  • Hierarchically segments sections into indexed, traceable chunks
           │  • Implements fast term & heading relevance scoring (TF-IDF / BM25-style)
           ▼
Local Session Cache (`chrome.storage.local`)
           │  • URL-isolated page memory (prevents cross-page context leaking)
           ▼
User Inquiries (Side Panel / Popup UI)
           │  • Top 6 most relevant chunks selected for the question
           │  • Recent conversation turns preserved for natural follow-ups
           ▼
FastAPI Backend Endpoint (`POST http://localhost:8000/api/extension/ask`)
           │  • Strict grounding system prompt with zero external hallucination
           ▼
Groq LLM Inference Engine (`openai/gpt-oss-20b` / `qwen/qwen3.8-27b` / `llama-3.3-70b-versatile`)
           │  • High-speed reasoning with candidate model fallback
           ▼
Grounded Answer + Clickable Section Sources
```

---

## Key Features

1. **Two Primary Controls (`FETCH` & `CLEAR`)**:
   - **`FETCH`**: Detects active tab, reads webpage DOM, extracts clean visible text, removes noisy ads/cookie notices, builds searchable section chunks, and updates status with real word and section counts. Features real multi-phase progress (`Fetching page...` → `Extracting content...` → `Cleaning content...` → `Building knowledge context...` → `Ready`).
   - **`CLEAR`**: Instantly wipes page text, chunks, search index, and chat history for the current page without reloading the tab.
2. **Strict Grounding & Zero Hallucination**:
   - Answers are grounded strictly in the fetched page content.
   - When a user asks about something not present on the page (e.g. asking for Apple stock prices while viewing Kubernetes docs), Arjuna Sarthi explicitly states: *"I couldn't find that information in the fetched page."*
3. **Traceable Source Citations**:
   - Every assistant response includes collapsible sources citing the exact section heading, snippet, and link back to the document.
4. **Conversational Multi-Turn Follow-Ups**:
   - Supports contextual pronouns (e.g., *"What is Kubernetes?"* followed by *"Why is it useful?"*).
5. **Cross-Page Context Isolation**:
   - Each page's state is keyed by URL. Switching tabs or navigating to a new URL ensures Page A's context never contaminates Page B.
6. **Enterprise Security**:
   - **Zero client-side secrets**. No Groq API keys or credentials ever exist inside the extension source, dist bundle, or manifest. All AI reasoning is routed through the local FastAPI backend.

---

## Directory Structure

```
extension/
├── public/
│   ├── manifest.json         # Chrome Manifest V3 configuration
│   └── icons/                # High-res technical 'A' emblem icons (16, 32, 48, 128px)
├── src/
│   ├── background/
│   │   └── index.ts          # Manifest V3 service worker
│   ├── content/
│   │   └── index.ts          # Readability-style webpage DOM extractor
│   ├── services/
│   │   ├── api.ts            # Backend API communication (no hardcoded keys)
│   │   ├── chunker.ts        # RAG chunking & relevance ranking
│   │   └── storage.ts        # chrome.storage.local wrapper
│   ├── components/
│   │   ├── Header.tsx        # Brand header with 'A' emblem and model indicator
│   │   ├── PageStatusCard.tsx# Live tab title, URL domain, and status pill
│   │   ├── ControlButtons.tsx# FETCH and CLEAR buttons with real progress
│   │   ├── ContentSummaryDrawer.tsx # Collapsible section & word breakdown
│   │   ├── ChatSection.tsx   # Grounded conversation, suggested prompts, citations
│   │   └── SettingsModal.tsx # Backend URL config & live health probe
│   ├── types/
│   │   └── index.ts          # TypeScript data contracts
│   ├── App.tsx               # Main application container
│   ├── main.tsx              # React DOM entry
│   └── index.css             # Tailwind CSS tokens
├── dist/                     # Production unpacked build ready for Chrome
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Installation & Build Instructions

### Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **FastAPI Backend**: Running on `http://localhost:8000` (Docker container `mt-backend`)

### 1. Build the Extension
In your terminal, navigate to the `extension` directory:

```bash
cd extension
npm install
npm run build
```

This compiles the extension into the `extension/dist/` directory:
- `dist/manifest.json`
- `dist/index.html`
- `dist/background.js`
- `dist/content.js`
- `dist/assets/`
- `dist/icons/`

---

## Loading Unpacked Extension into Chrome / Chromium

1. Open **Google Chrome** (or Brave / Edge / Chromium).
2. Navigate to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker, select the `dist` folder:
   ```
   /Users/darshanpatil/Downloads/Vcet/extension/dist
   ```
6. **Arjuna Sarthi** will appear in your extensions list! Pin it to your Chrome toolbar for instant access.

---

## Extension Permissions Explained

| Permission | Purpose |
| :--- | :--- |
| `activeTab` | Grants temporary access to read the active webpage content when the user clicks FETCH. |
| `scripting` | Allows injecting the high-precision content extraction script into the active page on demand. |
| `storage` | Uses `chrome.storage.local` to store temporary page chunks, conversation history, and API settings. |
| `tabs` | Queries the current tab's URL and title to detect navigation and ensure cross-page isolation. |
| `sidePanel` | Enables opening Arjuna Sarthi as a persistent side panel beside your browser tabs. |

---

## Verification & Manual Testing Guide

### Test 1: Grounded Q&A on Public Documentation
1. Navigate to: `https://en.wikipedia.org/wiki/Kubernetes`
2. Open **Arjuna Sarthi** from your extensions toolbar.
3. Click **FETCH**. Watch the real progress stages (`Fetching page...` → `Extracting content...` → `Cleaning content...` → `Building knowledge context...` → `FETCHED ✓`).
4. Notice the real word count (~8,000+ words) and section breakdown.
5. In the chat box, ask:
   > *"What is Kubernetes?"*
6. Verify the grounded answer with clickable section sources citing the exact section of the page.

### Test 2: Conversational Multi-Turn Follow-Up
1. On the same page, ask:
   > *"What are Pods?"*
2. Then ask:
   > *"Why are they important?"*
3. Verify that the answer understands that *"they"* refers to Pods and answers from the page context.

### Test 3: Insufficient Information (Anti-Hallucination)
1. On the Kubernetes Wikipedia page, ask:
   > *"What is the current stock price of Apple?"*
2. Verify that Arjuna Sarthi does **not** answer from general training knowledge and responds:
   > *"I couldn't find that information in the fetched page."*

### Test 4: CLEAR & Cross-Page Isolation
1. Click the **CLEAR** button.
2. Verify that chat history, chunks, and page context reset to *"Ready to fetch"*.
3. Navigate to a different page (e.g. `https://github.com/features/actions`).
4. Click **FETCH**.
5. Ask a question about GitHub Actions. Confirm that no Kubernetes context is leaked.

---

## Troubleshooting

- **"AI service unavailable. Please check the backend connection."**:
  Ensure the FastAPI backend container is running:
  ```bash
  docker compose up -d backend
  curl http://localhost:8000/api/extension/health
  ```
  Expected output: `{"status":"ready","model":"qwen/qwen3.8-27b","groq_configured":true,"version":"1.0.0"}`
- **Cannot fetch browser internal pages**:
  Chrome forbids extensions from executing content scripts on `chrome://` and `chrome-extension://` pages for security reasons. Navigate to any HTTP/HTTPS website.
