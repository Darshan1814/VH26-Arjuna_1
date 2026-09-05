/**
 * Core type definitions for Arjuna Sarthi Web Intelligence Extension.
 */

export interface PageMetadata {
  title: string;
  url: string;
  domain: string;
  fetchedAt?: string;
  wordCount: number;
  sectionCount: number;
  headingCount: number;
  isPdfOrDoc?: boolean;
  documentViewerWarning?: string;
}

export interface ContentChunk {
  id: string;
  title: string;
  heading: string;
  section: string;
  content: string;
  url: string;
  relevanceScore?: number;
}

export interface ExtractedSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  wordCount: number;
  subheadings?: string[];
}

export interface ExtractedPage {
  metadata: PageMetadata;
  sections: ExtractedSection[];
  cleanText: string;
  chunks: ContentChunk[];
}

export interface SourceCitation {
  title?: string;
  heading?: string;
  section?: string;
  url?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: SourceCitation[];
  grounded?: boolean;
  model?: string;
  isLoading?: boolean;
  error?: string;
}

export type FetchStep =
  | "idle"
  | "fetching"
  | "extracting"
  | "cleaning"
  | "chunking"
  | "ready"
  | "failed";

export interface ExtensionConfig {
  apiUrl: string;
  autoFetchOnOpen?: boolean;
}

export interface AskRequestPayload {
  url: string;
  title: string;
  question: string;
  context: ContentChunk[];
  conversation: { role: string; content: string }[];
}

export interface AskResponsePayload {
  answer: string;
  sources: SourceCitation[];
  model: string;
  grounded: boolean;
}
