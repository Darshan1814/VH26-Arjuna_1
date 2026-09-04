/**
 * Arjuna Sarthi - Local Storage Service.
 *
 * Interacts with chrome.storage.local for temporary session state,
 * page content caching, and conversation history isolation.
 */

import { ChatMessage, ContentChunk, ExtractedPage } from "../types";

export interface StoredPageState {
  url: string;
  page: ExtractedPage;
  chunks: ContentChunk[];
  messages: ChatMessage[];
  lastUpdated: number;
}

const STORAGE_KEY_PREFIX = "arjuna_page_";
const LAST_ACTIVE_URL_KEY = "arjuna_last_active_url";

export async function savePageState(
  url: string,
  page: ExtractedPage,
  chunks: ContentChunk[],
  messages: ChatMessage[]
): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const key = `${STORAGE_KEY_PREFIX}${encodeURIComponent(url)}`;
  const data: StoredPageState = {
    url,
    page,
    chunks,
    messages,
    lastUpdated: Date.now(),
  };

  await chrome.storage.local.set({
    [key]: data,
    [LAST_ACTIVE_URL_KEY]: url,
  });
}

export async function getPageState(url: string): Promise<StoredPageState | null> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return null;
  }

  const key = `${STORAGE_KEY_PREFIX}${encodeURIComponent(url)}`;
  const result = await chrome.storage.local.get([key]);
  return result[key] || null;
}

export async function clearPageState(url: string): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const key = `${STORAGE_KEY_PREFIX}${encodeURIComponent(url)}`;
  await chrome.storage.local.remove([key, LAST_ACTIVE_URL_KEY]);
}

export async function clearAllExtensionData(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter((k) =>
    k.startsWith(STORAGE_KEY_PREFIX) || k === LAST_ACTIVE_URL_KEY
  );

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}
