/**
 * Shared TypeScript types matching backend Pydantic schemas.
 */

// === RAG Response ===

export interface Citation {
  manual: string;
  machine_model: string;
  section?: string;
  heading?: string;
  page?: number;
  pdf_page?: number;
  chunk_id?: string;
  relevance_score?: number;
}

export interface WhatIfComparisonItem {
  action: string;
  relevance: string;
  intervention_level: string;
  manual_supported: boolean;
  notes?: string;
}

export interface WhatIfEvidenceItem {
  evidence_type: "manual" | "inference" | "unknown";
  statement: string;
  citation_ref?: string;
}

export interface WhatIfAnalysis {
  scenario_type: string;
  current_situation: Record<string, any>;
  hypothetical_action: string;
  possible_outcome?: string;
  why?: string;
  documented_facts: string[];
  reasoned_inferences: string[];
  unknowns: string[];
  timeline: string[];
  comparison_table: WhatIfComparisonItem[];
  recommended_action?: string;
  safety_warning?: string;
  evidence_items: WhatIfEvidenceItem[];
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
  is_what_if?: boolean;
  what_if_analysis?: WhatIfAnalysis;
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
  is_what_if?: boolean;
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
