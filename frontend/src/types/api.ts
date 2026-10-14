export type AuthMode = "login" | "register";
export type DocumentStatus = "processing" | "ready" | "failed";
export type MessageRole = "user" | "assistant";

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  extension: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  current_version?: number;
  page_count: number;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  filename: string;
  content_hash: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  created_at: string;
}

export interface DocumentSummary {
  document_id: string;
  filename: string;
  executive_summary: string;
  key_points: string[];
  important_dates: string[];
  key_entities: string[];
  source_references: Array<{
    chunk_id?: string;
    page_number: number;
    snippet: string;
    section_title?: string;
  }>;
  provider: string;
}

export interface ScholarshipChecklist {
  document_id: string;
  filename: string;
  title: string;
  eligibility_criteria: Array<{ criterion: string; source_page?: number }>;
  required_documents: Array<{ document_name: string; mandatory: boolean; source_page?: number }>;
  application_deadlines: Array<{ deadline_type: string; date_or_description: string; source_page?: number }>;
  deliverables: Array<{ deliverable: string; details?: string; source_page?: number }>;
  important_conditions: string[];
  source_references: Array<{ page_number: number; chunk_id?: string; snippet: string }>;
  provider: string;
}

export interface PdfCompressionResult {
  document_id?: string;
  filename?: string;
  original_size_bytes: number;
  output_size_bytes: number;
  reduction_bytes: number;
  reduction_percentage: number;
  verified: boolean;
  replaced_original: boolean;
  page_count?: number;
}

export interface DocumentPreview {
  document_id: string;
  filename: string;
  extension: string;
  page_count: number;
  chunk_count: number;
  current_version: number;
  size_bytes: number;
  preview_pages: Array<{
    page_number: number;
    section_title: string;
    snippet: string;
  }>;
  file_url: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  document_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  page_number: number;
  page_end?: number;
  chunk_id: string;
  section_title: string;
  snippet: string;
  score: number;
  match_level?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  streaming?: boolean;
  failed?: boolean;
}

export interface ChatModel {
  id: string;
  label?: string;
  description?: string;
}

export interface Settings {
  app_name: string;
  user: User;
  provider: string;
  openai_configured: boolean;
  chat_model: string;
  chat_models: ChatModel[];
  embedding_model: string;
  embedding_dimensions: number;
  max_file_mb: number;
  allowed_extensions: string[];
}

export interface ReadyStatus {
  status: string;
  database: string;
  openai_configured: boolean;
  chat_provider: string;
}

export interface StreamMetadata {
  model: string;
  input_tokens: number;
  output_tokens: number;
  warning?: string | null;
}

export interface StreamHandlers {
  message?: (data: { user_message_id: string; assistant_message_id: string }) => void;
  token?: (data: { text: string }) => void;
  citations?: (data: Citation[]) => void;
  metadata?: (data: StreamMetadata) => void;
  done?: (data: { message_id: string }) => void;
}
