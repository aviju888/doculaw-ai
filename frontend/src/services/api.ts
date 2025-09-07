import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Document,
  ChatMessage,
  ChatSession,
  ApiResponse,
  DocumentUploadResponse,
  SimplificationRequest,
  SearchQuery,
  SearchResult,
} from '../types';
import { UserProfile } from '../utils/helpers';
import { documentService, chatService, authService } from './dataService';

class ApiService {
  private api: AxiosInstance;
  private isDemoMode: boolean;

  constructor() {
    // Enable demo mode when no backend URL is set or explicitly enabled
    this.isDemoMode = !process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_DEMO_MODE === 'true';
    
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth tokens
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Document Management
  async uploadDocument(file: File): Promise<DocumentUploadResponse> {
    if (this.isDemoMode) {
      console.log('🎭 Mock document upload:', file.name);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create mock document
      const mockDoc = await documentService.createDocument({
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        content: 'This is a simplified version of your uploaded document. In the real application, AI would process and simplify the actual content.',
        originalContent: 'Original document content would be extracted and stored here.',
        summary: 'AI-generated summary of the document would appear here.',
        complexity: 'medium',
        type: 'Uploaded Document',
        fileSize: file.size,
        pageCount: Math.ceil(file.size / 2000), // Rough estimate
      });
      
      return {
        documentId: mockDoc?.id || 'mock-doc-id',
        status: 'completed',
        estimatedProcessingTime: 0,
      };
    }
    
    const formData = new FormData();
    formData.append('document', file);
    
    const response = await this.api.post<ApiResponse<DocumentUploadResponse>>(
      '/documents/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data.data;
  }

  async getDocument(documentId: string): Promise<Document> {
    const response = await this.api.get<ApiResponse<Document>>(
      `/documents/${documentId}`
    );
    return response.data.data;
  }

  async getDocuments(): Promise<Document[]> {
    if (this.isDemoMode) {
      console.log('🎭 Mock get documents');
      const { documents } = await documentService.getUserDocuments();
      return documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        originalTitle: doc.originalTitle,
        originalContent: doc.originalContent || '',
        simplifiedContent: doc.simplifiedContent,
        uploadDate: new Date(doc.createdAt || Date.now()),
        processedDate: new Date(doc.createdAt || Date.now()),
        status: doc.status as 'processing' | 'completed' | 'error' || 'completed',
        type: doc.type,
        fileType: 'application/pdf', // Mock file type
        fileSize: doc.fileSize || 0,
        pageCount: doc.pageCount,
        summary: doc.summary,
        complexity: doc.complexity as 'low' | 'medium' | 'high' || 'medium',
        simplificationLevel: doc.simplificationLevel,
        tags: doc.tags,
      }));
    }
    
    const response = await this.api.get<ApiResponse<Document[]>>('/documents');
    return response.data.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.api.delete(`/documents/${documentId}`);
  }

  async simplifyDocument(request: SimplificationRequest): Promise<Document> {
    const response = await this.api.post<ApiResponse<Document>>(
      '/documents/simplify',
      request
    );
    return response.data.data;
  }

  // Chat Functionality
  async createChatSession(): Promise<ChatSession> {
    const response = await this.api.post<ApiResponse<ChatSession>>('/chat/sessions');
    return response.data.data;
  }

  async getChatSession(sessionId: string): Promise<ChatSession> {
    const response = await this.api.get<ApiResponse<ChatSession>>(
      `/chat/sessions/${sessionId}`
    );
    return response.data.data;
  }

  async getChatSessions(): Promise<ChatSession[]> {
    const response = await this.api.get<ApiResponse<ChatSession[]>>('/chat/sessions');
    return response.data.data;
  }

  async sendMessage(sessionId: string, message: string, documentId?: string): Promise<ChatMessage> {
    const response = await this.api.post<ApiResponse<ChatMessage>>(
      `/chat/sessions/${sessionId}/messages`,
      {
        content: message,
        documentId,
      }
    );
    return response.data.data;
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    await this.api.delete(`/chat/sessions/${sessionId}`);
  }

  // Search Functionality
  async searchDocuments(query: SearchQuery): Promise<SearchResult[]> {
    const response = await this.api.post<ApiResponse<SearchResult[]>>(
      '/search/documents',
      query
    );
    return response.data.data;
  }

  async searchSimilarDocuments(documentId: string): Promise<SearchResult[]> {
    const response = await this.api.get<ApiResponse<SearchResult[]>>(
      `/search/similar/${documentId}`
    );
    return response.data.data;
  }

  // Legal Research
  async getLegalConcepts(text: string): Promise<string[]> {
    const response = await this.api.post<ApiResponse<string[]>>(
      '/legal/concepts',
      { text }
    );
    return response.data.data;
  }

  async getRelatedLaws(documentId: string): Promise<SearchResult[]> {
    const response = await this.api.get<ApiResponse<SearchResult[]>>(
      `/legal/related-laws/${documentId}`
    );
    return response.data.data;
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.api.get<ApiResponse<{ status: string; timestamp: string }>>(
      '/health'
    );
    return response.data.data;
  }
}

export const apiService = new ApiService();
export default apiService;

// User data service functions
export const userService = {
  // Save user profile (will integrate with backend later)
  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    try {
      // TODO: Replace with actual API call when backend is ready
      // For now, simulate API behavior
      console.log('Saving user profile to user.json:', profile);
      
      // In production, this would be:
      // const response = await fetch('/api/users/profile', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(profile)
      // });
      // return response.json();
      
      return Promise.resolve(profile);
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }
  },

  // Get user profile (will integrate with backend later)
  async getProfile(userId?: string): Promise<UserProfile | null> {
    try {
      // TODO: Replace with actual API call when backend is ready
      console.log('Fetching user profile from user.json');
      
      // In production, this would be:
      // const response = await fetch(`/api/users/profile/${userId || 'current'}`);
      // return response.json();
      
      return Promise.resolve(null);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  // Update user profile (will integrate with backend later)
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      console.log('Updating user profile in user.json:', updates);
      
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch('/api/users/profile', {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(updates)
      // });
      // return response.json();
      
      return Promise.resolve(updates as UserProfile);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  // Get all profiles (for admin/analytics - will integrate with backend later)
  async getAllProfiles(): Promise<UserProfile[]> {
    try {
      console.log('Fetching all user profiles from user.json');
      
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch('/api/users/profiles');
      // return response.json();
      
      return Promise.resolve([]);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      return [];
    }
  }
}; 