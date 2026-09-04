/**
 * API client for communicating with the backend.
 *
 * All requests go through the Next.js rewrite proxy (/api/* → backend:8000/api/*)
 * so we don't need to handle CORS on the client side.
 */

import type { RAGResponse, RAGQueryRequest, Machine, Manual, HealthStatus } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text().catch(() => "Unknown error");
    throw new Error(`API Error (${res.status}): ${error}`);
  }

  return res.json();
}

// === Health ===

export async function checkHealth(): Promise<HealthStatus> {
  return fetchAPI<HealthStatus>("/health");
}

// === Machines ===

export async function getMachines(): Promise<Machine[]> {
  return fetchAPI<Machine[]>("/api/machines");
}

// === Manuals ===

export async function getManuals(machineId?: string): Promise<Manual[]> {
  const query = machineId ? `?machine_id=${machineId}` : "";
  return fetchAPI<Manual[]>(`/api/manuals${query}`);
}

export async function uploadManual(
  file: File,
  machineId: string,
  title: string
): Promise<{ id: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("machine_id", machineId);
  formData.append("title", title);

  const res = await fetch(`${API_BASE}/api/manuals/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }

  return res.json();
}

// === RAG Query ===

export async function queryRAG(request: RAGQueryRequest): Promise<RAGResponse> {
  return fetchAPI<RAGResponse>("/api/rag/query", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// === Conversations ===

export async function createConversation(
  machineId?: string,
  title?: string
): Promise<{ id: string }> {
  return fetchAPI("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ machine_id: machineId, title }),
  });
}

export async function getConversationMessages(
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  return fetchAPI(`/api/conversations/${conversationId}/messages`);
}
