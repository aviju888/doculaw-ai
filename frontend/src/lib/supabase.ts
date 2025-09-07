import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase environment variables not found. Make sure to set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (supabase) {
  console.log('✅ Supabase client initialized successfully');
} else {
  console.log('❌ Supabase client not initialized - running in mock mode');
}

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          preferences: UserPreferences;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          preferences?: UserPreferences;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          preferences?: UserPreferences;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          original_title: string | null;
          original_content: string;
          simplified_content: string | null;
          file_type: string;
          file_size: number;
          page_count: number | null;
          summary: string | null;
          complexity: 'low' | 'medium' | 'high' | null;
          simplification_level: number | null;
          tags: string[] | null;
          status: 'processing' | 'completed' | 'error';
          type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          original_title?: string | null;
          original_content: string;
          simplified_content?: string | null;
          file_type: string;
          file_size: number;
          page_count?: number | null;
          summary?: string | null;
          complexity?: 'low' | 'medium' | 'high' | null;
          simplification_level?: number | null;
          tags?: string[] | null;
          status?: 'processing' | 'completed' | 'error';
          type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          original_title?: string | null;
          original_content?: string;
          simplified_content?: string | null;
          file_type?: string;
          file_size?: number;
          page_count?: number | null;
          summary?: string | null;
          complexity?: 'low' | 'medium' | 'high' | null;
          simplification_level?: number | null;
          tags?: string[] | null;
          status?: 'processing' | 'completed' | 'error';
          type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          content: string;
          sender: 'user' | 'ai';
          references: DocumentReference[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          content: string;
          sender: 'user' | 'ai';
          references?: DocumentReference[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          user_id?: string;
          content?: string;
          sender?: 'user' | 'ai';
          references?: DocumentReference[] | null;
          created_at?: string;
        };
      };
    };
  };
}

export interface UserPreferences {
  language: string;
  simplificationLevel: 'basic' | 'intermediate' | 'advanced';
  theme: 'light' | 'dark';
  notifications: boolean;
}

export interface DocumentReference {
  id: string;
  title: string;
  relevantSection: string;
  confidence: number;
} 