/**
 * Arjuna Sarthi - Backend API Communication Service.
 *
 * Routes all intelligence and reasoning requests through the FastAPI backend
 * to interact with Groq securely without exposing any API keys in client bundles.
 */

import { AskRequestPayload, AskResponsePayload } from "../types";

export const DEFAULT_BACKEND_URL = "http://localhost:8000";

export async function getBackendBaseUrl(): Promise<string> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(["backendUrl"]);
      if (stored && stored.backendUrl && typeof stored.backendUrl === "string") {
        return stored.backendUrl.replace(/\/+$/, "");
      }
    } catch {
      // Fallback to default
    }
  }
  return DEFAULT_BACKEND_URL;
}

export async function checkBackendHealth(customUrl?: string): Promise<{
  status: "connected" | "disconnected";
  model?: string;
  error?: string;
}> {
  const baseUrl = customUrl || (await getBackendBaseUrl());
  const endpoint = `${baseUrl}/api/extension/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        status: "disconnected",
        error: `Backend returned HTTP status: ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      status: "connected",
      model: data.model || "Groq Inference Engine",
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        status: "disconnected",
        error: "Backend health check timed out. Ensure localhost:8000 is accessible.",
      };
    }
    return {
      status: "disconnected",
      error:
        "AI service unavailable. Please ensure the backend server is running on http://localhost:8000.",
    };
  }
}

export async function askQuestion(
  payload: AskRequestPayload
): Promise<AskResponsePayload> {
  const baseUrl = await getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/extension/ask`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s for LLM generation

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      let detail = `Error (${res.status})`;
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch {
        const text = await res.text().catch(() => "");
        detail = text || detail;
      }

      if (res.status === 429) {
        throw new Error("Rate limit reached. Please wait a few moments before trying again.");
      }
      if (res.status === 502 || res.status === 503) {
        throw new Error("AI reasoning engine is temporarily unavailable. Check backend logs.");
      }
      throw new Error(detail);
    }

    const data: AskResponsePayload = await res.json();
    return data;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out waiting for AI response.");
    }
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error(
        "Could not connect to backend at http://localhost:8000. Ensure the Machine Troubleshooter server is running."
      );
    }
    throw err;
  }
}
