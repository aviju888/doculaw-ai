// Document types
export interface Document {
  id: string;
  title: string;
  originalContent: string;
  simplifiedContent?: string;
  uploadDate: string;
  processedDate?: string;
  status: 'processing' | 'completed' | 'error';
  fileType: string;
  fileSize: number;
  summary?: string;
  complexity?: 'low' | 'medium' | 'high';
  tags?: string[];
}

// Chat types
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
  documentId?: string;
  references?: DocumentReference[];
}

export interface DocumentReference {
  id: string;
  title: string;
  relevantSection: string;
  confidence: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// API types
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface DocumentUploadResponse {
  documentId: string;
  status: string;
  estimatedProcessingTime: number;
}

export interface SimplificationRequest {
  documentId: string;
  simplificationLevel: 'basic' | 'intermediate' | 'advanced';
  userContext?: {
    englishProficiency?: string;
    legalExperience?: string;
    readingPreference?: string;
  };
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  documentType?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  complexity?: ('low' | 'medium' | 'high')[];
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  documentType: string;
  lastModified: string;
}

// Vector types for Pinecone
export interface VectorDocument {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
}
