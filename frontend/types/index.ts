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
  source_type?: string;
  file_name?: string;
  evidence_image_url?: string;
}

export interface RecommendedSolution {
  priority: number;
  action: string;
  reason: string;
  evidence_strength: string;
  source: string;
  is_verified: boolean;
}

export interface EvidenceImage {
  path: string;
  url: string;
  caption: string;
}

export interface RAGResponse {
  problem?: string;
  diagnosis?: string;
  answer: string;
  probable_causes: string[];
  corrective_steps: string[];
  recommended_solutions: RecommendedSolution[];
  safety_warnings: string[];

  // Confidence scoring
  confidence: number;
  confidence_level: "HIGH" | "MEDIUM" | "LOW" | string;
  confidence_reasons?: string[];

  // Traceable citations & evidence images
  citations: Citation[];
  evidence_images?: EvidenceImage[];

  // Disambiguation
  is_ambiguous: boolean;
  ambiguity_message?: string;
  ambiguous_machines: string[];

  // Refusal
  is_insufficient: boolean;
  insufficient_message?: string;

  // Detected metadata
  detected_error_code?: string;
  detected_machine?: string;
  query_type?: string;

  // Context & reports
  conversation_id?: string;
  report_id?: string;
  report_pdf_url?: string;
  report_html_url?: string;
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

// === Process Flow Telemetry ===

export interface FlowStepTelemetry {
  step: number;
  title: string;
  status: string;
  [key: string]: any;
}

export interface FlowSessionState {
  session_id: string;
  current_step: number;
  files: { name: string; size: number }[];
  step_data: Record<number, FlowStepTelemetry>;
  query?: string;
  selected_machine?: string;
  report_id?: string;
  final_result?: any;
  status: string;
}

// === Reports ===

export interface ReportMeta {
  report_id: string;
  has_pdf: boolean;
  has_html: boolean;
  pdf_url: string;
  html_url: string;
}
