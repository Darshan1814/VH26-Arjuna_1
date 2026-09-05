/**
 * API client for communicating with the backend.
 *
 * All requests go through the Next.js rewrite proxy (/api/* → backend:8000/api/*)
 * or direct backend URL so we don't need to handle CORS on the client side.
 */

import type {
  RAGResponse,
  RAGQueryRequest,
  Machine,
  Manual,
  HealthStatus,
  Conversation,
  FlowSessionState,
  ReportMeta,
} from "@/types";

export const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) {
    return process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    // In browser on EC2 or production, use relative URL ("") so requests target the
    // current host and route smoothly through Next.js rewrites to backend container
    return "";
  }
  return (process.env.BACKEND_URL || "http://backend:8000").replace(/\/$/, "");
};

export const API_BASE = getApiBase();

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;
  try {
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
  } catch (err: any) {
    console.error(`Fetch error for ${url}:`, err);
    throw err;
  }
}

// === Health ===

export async function checkHealth(): Promise<HealthStatus> {
  return fetchAPI<HealthStatus>("/health");
}

// === Machines ===

export async function getMachines(): Promise<Machine[]> {
  return fetchAPI<Machine[]>("/api/machines");
}

export async function getMachine(id: string): Promise<Machine> {
  return fetchAPI<Machine>(`/api/machines/${id}`);
}

// === Manuals & Knowledge Upload ===

export async function getManuals(machineId?: string): Promise<Manual[]> {
  const query = machineId ? `?machine_id=${machineId}` : "";
  return fetchAPI<Manual[]>(`/api/manuals${query}`);
}

export async function getManualSuggestions(): Promise<{ status: string; suggestions: string[]; active_manual?: string }> {
  return fetchAPI<{ status: string; suggestions: string[]; active_manual?: string }>("/api/manuals/suggestions");
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

  const res = await fetch(`${getApiBase()}/api/manuals/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${err || res.statusText}`);
  }

  return res.json();
}

export async function uploadKnowledgeFiles(
  files: File[],
  machineModel?: string
): Promise<{ status: string; files_processed: number; total_chunks_stored: number }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (machineModel) {
    formData.append("machine_model", machineModel);
  }

  const res = await fetch(`${getApiBase()}/api/upload/knowledge`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${err || res.statusText}`);
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

// === Process Flow ===

export async function uploadFlowFiles(
  files: File[],
  sessionId?: string
): Promise<{ status: string; session_id: string; files_count: number }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  const res = await fetch(`${API_BASE}/api/process-flow/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Upload failed");
    throw new Error(`Process Flow upload error: ${err}`);
  }

  return res.json();
}

export async function executeFlowStep(
  sessionId: string,
  stepNum: number,
  userInput?: Record<string, any>
): Promise<{ status: string; session_id: string; step: number; telemetry: any }> {
  return fetchAPI(`/api/process-flow/${sessionId}/step/${stepNum}`, {
    method: "POST",
    body: JSON.stringify({ user_input: userInput || {} }),
  });
}

export async function getFlowSession(sessionId: string): Promise<FlowSessionState> {
  return fetchAPI<FlowSessionState>(`/api/process-flow/${sessionId}`);
}

export async function restartFlowSession(
  sessionId: string
): Promise<{ status: string; session_id: string; current_step: number }> {
  return fetchAPI(`/api/process-flow/${sessionId}/restart`, {
    method: "POST",
  });
}

export async function removeFlowFile(
  sessionId: string,
  filename: string
): Promise<{ status: string; removed: string; total_files: number }> {
  return fetchAPI(`/api/process-flow/${sessionId}/files/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export async function getFlowSessionFiles(
  sessionId: string
): Promise<{ session_id: string; total_files: number; files: any[] }> {
  return fetchAPI(`/api/process-flow/${sessionId}/files`);
}

// === Reports ===

export async function generateReport(payload: any): Promise<{
  status: string;
  report_id: string;
  pdf_url: string;
  html_url: string;
  download_url: string;
}> {
  return fetchAPI("/api/reports/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getReportMeta(reportId: string): Promise<ReportMeta> {
  return fetchAPI<ReportMeta>(`/api/reports/${reportId}`);
}

export async function downloadDirectPDF(payload: any, filename?: string): Promise<void> {
  const res = await fetch("/api/reports/download-direct-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate PDF: ${res.statusText}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `Diagnostic_Report_${payload.report_id || Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// === Conversations ===

export async function createConversation(
  machineId?: string,
  title?: string
): Promise<Conversation> {
  return fetchAPI<Conversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ machine_id: machineId, title }),
  });
}

export async function getConversationMessages(
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  return fetchAPI(`/api/conversations/${conversationId}/messages`);
}
