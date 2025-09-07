// Super simple auth - just username/password
import { supabase } from '../lib/supabase';

// Document and Chat interfaces
export interface DocumentData {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  status?: string;
  complexity?: string;
  originalTitle?: string;
  summary?: string;
  simplificationLevel?: number;
  pageCount?: number;
  fileSize?: number;
  type?: string;
  createdAt?: string;
  originalContent?: string;
  simplifiedContent?: string;
  userId?: string;
}

export interface ChatMessageData {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  documentId?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
}

// Document Service
export const documentService = {
  getAllDocuments: async (): Promise<DocumentData[]> => {
    if (!supabase) {
      console.log('📝 Using mock documents');
      return mockDocuments;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return [];
      }

      return data?.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.simplified_content || doc.original_content,
        originalContent: doc.original_content,
        simplifiedContent: doc.simplified_content,
        originalTitle: doc.original_title,
        summary: doc.summary,
        complexity: doc.complexity,
        status: doc.status,
        type: doc.type,
        tags: doc.tags || [],
        simplificationLevel: doc.simplification_level,
        pageCount: doc.page_count,
        fileSize: doc.file_size,
        createdAt: doc.created_at,
        userId: doc.user_id,
      })) || [];
    } catch (error) {
      console.error('Error in getAllDocuments:', error);
      return [];
    }
  },

  getUserDocuments: async (): Promise<{ documents: DocumentData[]; error: string | null }> => {
    if (!supabase) {
      console.log('📝 Using mock user documents');
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return { documents: [], error: 'Not authenticated' };
      }
      const userDocs = mockDocuments.filter(doc => doc.userId === currentUser.id);
      return { documents: userDocs, error: null };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { documents: [], error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return { documents: [], error: error.message };
      }

      const documents = data?.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.simplified_content || doc.original_content,
        originalContent: doc.original_content,
        simplifiedContent: doc.simplified_content,
        originalTitle: doc.original_title,
        summary: doc.summary,
        complexity: doc.complexity,
        status: doc.status,
        type: doc.type,
        tags: doc.tags || [],
        simplificationLevel: doc.simplification_level,
        pageCount: doc.page_count,
        fileSize: doc.file_size,
        createdAt: doc.created_at,
        userId: doc.user_id,
      })) || [];

      return { documents, error: null };
    } catch (error) {
      return { documents: [], error: 'Failed to fetch documents' };
    }
  },

  getDocument: async (id: string): Promise<{ document: DocumentData | null; error: string | null }> => {
    if (!supabase) {
      console.log('📝 Using mock document:', id);
      const document = mockDocuments.find(doc => doc.id === id);
      return { document: document || null, error: document ? null : 'Document not found' };
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { document: null, error: error.message };
      }

      const document = {
        id: data.id,
        title: data.title,
        content: data.simplified_content || data.original_content,
        originalContent: data.original_content,
        simplifiedContent: data.simplified_content,
        originalTitle: data.original_title,
        summary: data.summary,
        complexity: data.complexity,
        status: data.status,
        type: data.type,
        tags: data.tags || [],
        simplificationLevel: data.simplification_level,
        pageCount: data.page_count,
        fileSize: data.file_size,
        createdAt: data.created_at,
        userId: data.user_id,
      };

      return { document, error: null };
    } catch (error) {
      return { document: null, error: 'Failed to fetch document' };
    }
  },

  createDocument: async (documentData: Partial<DocumentData>): Promise<DocumentData | null> => {
    if (!supabase) {
      console.log('📝 Mock document creation');
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return null;
      }
      
      const newDoc: DocumentData = {
        id: String(Date.now()),
        title: documentData.title || 'Untitled Document',
        content: documentData.content || '',
        originalContent: documentData.originalContent || documentData.content || '',
        simplifiedContent: documentData.simplifiedContent,
        originalTitle: documentData.originalTitle,
        summary: documentData.summary,
        complexity: documentData.complexity || 'medium',
        status: documentData.status || 'completed',
        type: documentData.type || 'General',
        tags: documentData.tags || [],
        simplificationLevel: documentData.simplificationLevel || 3,
        pageCount: documentData.pageCount || 1,
        fileSize: documentData.fileSize || 1000,
        createdAt: new Date().toISOString(),
        userId: currentUser.id,
      };
      
      mockDocuments.push(newDoc);
      return newDoc;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: documentData.title || 'Untitled Document',
          original_content: documentData.originalContent || documentData.content || '',
          simplified_content: documentData.simplifiedContent,
          original_title: documentData.originalTitle,
          file_type: 'text/plain',
          file_size: documentData.fileSize || 0,
          summary: documentData.summary,
          complexity: documentData.complexity,
          tags: documentData.tags,
          type: documentData.type,
          status: documentData.status || 'completed',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating document:', error);
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        content: data.simplified_content || data.original_content,
        originalContent: data.original_content,
        simplifiedContent: data.simplified_content,
        originalTitle: data.original_title,
        summary: data.summary,
        complexity: data.complexity,
        status: data.status,
        type: data.type,
        tags: data.tags || [],
        simplificationLevel: data.simplification_level,
        pageCount: data.page_count,
        fileSize: data.file_size,
        createdAt: data.created_at,
        userId: data.user_id,
      };
    } catch (error) {
      console.error('Error in createDocument:', error);
      return null;
    }
  },

  updateDocument: async (id: string, updates: Partial<DocumentData>): Promise<DocumentData | null> => {
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          title: updates.title,
          simplified_content: updates.simplifiedContent,
          summary: updates.summary,
          complexity: updates.complexity,
          tags: updates.tags,
          status: updates.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating document:', error);
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        content: data.simplified_content || data.original_content,
        originalContent: data.original_content,
        simplifiedContent: data.simplified_content,
        originalTitle: data.original_title,
        summary: data.summary,
        complexity: data.complexity,
        status: data.status,
        type: data.type,
        tags: data.tags || [],
        simplificationLevel: data.simplification_level,
        pageCount: data.page_count,
        fileSize: data.file_size,
        createdAt: data.created_at,
        userId: data.user_id,
      };
    } catch (error) {
      console.error('Error in updateDocument:', error);
      return null;
    }
  },

  deleteDocument: async (id: string): Promise<boolean> => {
    if (!supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting document:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteDocument:', error);
      return false;
    }
  },
};

// Chat Service
export const chatService = {
  getMessages: async (documentId: string): Promise<ChatMessageData[]> => {
    if (!supabase) {
      console.log('💬 Using mock chat messages for document:', documentId);
      return mockChatMessages[documentId] || [];
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return data?.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        documentId: msg.document_id,
        createdAt: msg.created_at,
      })) || [];
    } catch (error) {
      console.error('Error in getMessages:', error);
      return [];
    }
  },

  sendMessage: async (documentId: string, content: string): Promise<ChatMessageData | null> => {
    if (!supabase) {
      console.log('💬 Mock sending message to document:', documentId);
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return null;
      }
      
      const newMessage: ChatMessageData = {
        id: 'msg' + Date.now(),
        content,
        sender: 'user',
        documentId,
        createdAt: new Date().toISOString(),
      };
      
      // Add to mock messages
      if (!mockChatMessages[documentId]) {
        mockChatMessages[documentId] = [];
      }
      mockChatMessages[documentId].push(newMessage);
      
      // Simulate AI response after a delay
      setTimeout(() => {
        const aiResponse: ChatMessageData = {
          id: 'ai' + Date.now(),
          content: `This is a mock AI response to: "${content}". In a real implementation, this would be processed by the AI legal assistant to provide helpful insights about your document.`,
          sender: 'ai',
          documentId,
          createdAt: new Date().toISOString(),
        };
        mockChatMessages[documentId].push(aiResponse);
      }, 2000);
      
      return newMessage;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          document_id: documentId,
          user_id: user.id,
          content,
          sender: 'user',
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return null;
      }

      return {
        id: data.id,
        content: data.content,
        sender: data.sender,
        documentId: data.document_id,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return null;
    }
  },
};

// Mock user data for demo
const mockUsers = [
  { id: '1', email: 'demo@doculaw.ai', username: 'Demo User', full_name: 'Demo User', password: 'demo123' },
  { id: '2', email: 'lawyer@doculaw.ai', username: 'Legal Expert', full_name: 'Sarah Johnson', password: 'lawyer123' },
  { id: '3', email: 'student@doculaw.ai', username: 'Law Student', full_name: 'Alex Chen', password: 'student123' },
];

// Mock documents for demo
const mockDocuments: DocumentData[] = [
  {
    id: '1',
    title: 'Employment Contract Analysis',
    originalTitle: 'Standard Employment Agreement - XYZ Corp',
    content: 'This simplified employment contract outlines your key rights and responsibilities as an employee.',
    originalContent: 'WHEREAS, the Company desires to employ the Employee, and the Employee desires to be employed by the Company, NOW THEREFORE, in consideration of the mutual covenants and agreements contained herein...',
    simplifiedContent: 'This simplified employment contract outlines your key rights and responsibilities as an employee. Key points: 1) You work full-time (40 hours/week), 2) Your salary is $75,000/year, 3) You get health benefits after 90 days, 4) Two weeks vacation per year.',
    summary: 'Standard employment contract with competitive salary and benefits package.',
    complexity: 'medium',
    status: 'completed',
    type: 'Employment Law',
    tags: ['contract', 'employment', 'benefits'],
    simplificationLevel: 3,
    pageCount: 12,
    fileSize: 45000,
    createdAt: '2024-01-15T10:30:00Z',
    userId: '1',
  },
  {
    id: '2',
    title: 'Rental Agreement Simplified',
    originalTitle: 'Residential Lease Agreement - Downtown Apartment',
    content: 'This rental agreement has been simplified to help you understand your rights and obligations as a tenant.',
    originalContent: 'THIS LEASE AGREEMENT is made this day between LESSOR and LESSEE for the premises located at...',
    simplifiedContent: 'This rental agreement has been simplified to help you understand your rights and obligations as a tenant. Key terms: 1) Monthly rent: $2,500, 2) Security deposit: $2,500, 3) Lease term: 12 months, 4) Pet policy: No pets allowed, 5) Utilities: Tenant pays electric and gas.',
    summary: 'One-year residential lease for downtown apartment with standard terms.',
    complexity: 'low',
    status: 'completed',
    type: 'Real Estate Law',
    tags: ['lease', 'rental', 'residential'],
    simplificationLevel: 2,
    pageCount: 8,
    fileSize: 32000,
    createdAt: '2024-01-20T14:15:00Z',
    userId: '1',
  },
  {
    id: '3',
    title: 'Privacy Policy Breakdown',
    originalTitle: 'Privacy Policy and Terms of Service - TechCorp Inc.',
    content: 'We have simplified this privacy policy to clearly explain how your personal data is collected and used.',
    originalContent: 'This Privacy Policy describes how TechCorp Inc. ("we," "us," or "our") collects, uses, and shares information about you...',
    simplifiedContent: 'We have simplified this privacy policy to clearly explain how your personal data is collected and used. Main points: 1) We collect your name, email, and usage data, 2) We use cookies to improve your experience, 3) We do not sell your data to third parties, 4) You can request data deletion anytime.',
    summary: 'Company privacy policy explaining data collection and user rights.',
    complexity: 'high',
    status: 'completed',
    type: 'Privacy Law',
    tags: ['privacy', 'data', 'policy'],
    simplificationLevel: 4,
    pageCount: 15,
    fileSize: 68000,
    createdAt: '2024-01-25T09:45:00Z',
    userId: '1',
  }
];

// Mock chat messages for demo
const mockChatMessages: { [documentId: string]: ChatMessageData[] } = {
  '1': [
    {
      id: 'msg1',
      content: 'Can you explain the termination clause in this employment contract?',
      sender: 'user',
      documentId: '1',
      createdAt: '2024-01-15T11:00:00Z',
    },
    {
      id: 'msg2',
      content: 'The termination clause allows either party to end the employment with two weeks notice. The company can terminate immediately for cause (misconduct, violation of policies). If terminated without cause, you may be eligible for severance pay based on length of service.',
      sender: 'ai',
      documentId: '1',
      createdAt: '2024-01-15T11:01:00Z',
    },
    {
      id: 'msg3',
      content: 'What about non-compete agreements?',
      sender: 'user',
      documentId: '1',
      createdAt: '2024-01-15T11:05:00Z',
    },
    {
      id: 'msg4',
      content: 'This contract includes a 6-month non-compete clause, meaning you cannot work for direct competitors for 6 months after leaving. However, non-compete enforceability varies by state. In California, for example, non-competes are generally unenforceable.',
      sender: 'ai',
      documentId: '1',
      createdAt: '2024-01-15T11:06:00Z',
    }
  ],
  '2': [
    {
      id: 'msg5',
      content: 'What are my rights if the landlord wants to increase rent?',
      sender: 'user',
      documentId: '2',
      createdAt: '2024-01-20T15:00:00Z',
    },
    {
      id: 'msg6',
      content: 'Based on this lease, rent increases are not allowed during the 12-month term unless specified. For future increases, most states require 30-60 days written notice. Some cities have rent control laws that limit how much rent can be increased annually.',
      sender: 'ai',
      documentId: '2',
      createdAt: '2024-01-20T15:01:00Z',
    }
  ]
};

// Mock authentication service for demo
export const authService = {
  signUp: async (email: string, password: string, fullName?: string) => {
    console.log('🎭 Mock signup:', email);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      return { success: false, error: 'User already exists' };
    }
    
    // Create new mock user
    const newUser = {
      id: String(mockUsers.length + 1),
      email,
      username: fullName || email.split('@')[0],
      full_name: fullName || email.split('@')[0],
      password
    };
    
    mockUsers.push(newUser);
    
    // Store in localStorage for persistence
    localStorage.setItem('demo_auth_user', JSON.stringify({
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      full_name: newUser.full_name
    }));
    localStorage.setItem('demo_auth_token', 'mock-jwt-token-' + newUser.id);
    
    return { success: true };
  },

  signIn: async (email: string, password: string) => {
    console.log('🎭 Mock signin:', email, 'Available users:', mockUsers.map(u => u.email));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For demo purposes, be more permissive with authentication
    let user = mockUsers.find(u => u.email === email);
    
    // If no exact email match, use the first demo user as fallback
    if (!user) {
      console.log('🎭 No exact email match, using demo user as fallback');
      user = mockUsers[0]; // Use first user as default
    }
    
    // For demo, we'll accept any password or use the demo user
    if (password.length < 3) {
      return { success: false, error: 'Password too short (minimum 3 characters for demo)' };
    }
    
    console.log('🎭 Authenticating user:', user);
    
    // Store in localStorage for persistence
    localStorage.setItem('demo_auth_user', JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name
    }));
    localStorage.setItem('demo_auth_token', 'mock-jwt-token-' + user.id);
    
    console.log('🎭 Authentication successful, stored user data');
    return { success: true };
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('demo_auth_user');
    const token = localStorage.getItem('demo_auth_token');
    
    if (!userStr || !token) {
      return null;
    }
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  signOut: () => {
    localStorage.removeItem('demo_auth_user');
    localStorage.removeItem('demo_auth_token');
    console.log('🎭 Mock signout completed');
  },

  // Helper method to check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('demo_auth_token');
  }
}; 