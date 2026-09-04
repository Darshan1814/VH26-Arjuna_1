/**
 * Shared TypeScript types matching backend Pydantic schemas.
 */

// === RAG Response ===

export interface Citation {
  manual: string;
  machine_model: string;
  section?: string;
  page?: number;
  chunk_id?: string;
  relevance_score?: number;
}

export interface RAGResponse {
  answer: string;
  probable_causes: string[];
  corrective_steps: string[];
  confidence: number;
  citations: Citation[];
  is_ambiguous: boolean;
  ambiguity_message?: string;
  ambiguous_machines: string[];
  is_insufficient: boolean;
  insufficient_message?: string;
  detected_error_code?: string;
  detected_machine?: string;
  query_type?: string;
  conversation_id?: string;
}

// === Chat ===

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  ragResponse?: RAGResponse;
  isLoading?: boolean;
  isError?: boolean;
}

// === Machine ===

export interface Machine {
  id: string;
  name: string;
  model_number: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  created_at: string;
}

// === Manual ===

export interface Manual {
  id: string;
  machine_id: string;
  title: string;
  filename: string;
  storage_path?: string;
  total_pages?: number;
  status: string;
  created_at: string;
}

// === Conversation ===

export interface Conversation {
  id: string;
  machine_id?: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

// === API ===

export interface RAGQueryRequest {
  query: string;
  machine_id?: string;
  conversation_id?: string;
  top_k?: number;
  rerank_top_k?: number;
  similarity_threshold?: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
}

// === Process Flow ===

export interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}
