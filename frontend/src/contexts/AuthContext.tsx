import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '../services/dataService';

// Helper function to convert mock user to Supabase format
const createSupabaseUser = (mockUser: any): User => ({
  id: mockUser.id,
  email: mockUser.email || '',
  user_metadata: { full_name: mockUser.full_name },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  confirmation_sent_at: new Date().toISOString(),
  email_confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
} as User);

const createSupabaseSession = (user: User): Session => ({
  user,
  access_token: 'mock-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
} as Session);

// Placeholder AuthContext for future Supabase integration
// Currently the app uses the mock dataService.ts

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (!supabase) {
        console.log('🎭 No Supabase client - using mock auth');
        
        // Check for existing mock user session
        const mockUser = authService.getCurrentUser();
        if (mockUser && mounted) {
          const supabaseUser = createSupabaseUser(mockUser);
          setUser(supabaseUser);
          setSession(createSupabaseSession(supabaseUser));
        }
        
        setLoading(false);
        return;
      }

      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user || null);
          setLoading(false);
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (mounted) {
              setSession(session);
              setUser(session?.user || null);
              setLoading(false);
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!supabase) {
      console.log('🎭 Using mock signup');
      const result = await authService.signUp(email, password, fullName);
      
      if (result.success) {
        const mockUser = authService.getCurrentUser();
        if (mockUser) {
          const supabaseUser = createSupabaseUser(mockUser);
          setUser(supabaseUser);
          setSession(createSupabaseSession(supabaseUser));
        }
      }
      
      return result;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to sign up' };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      console.log('🎭 Using mock signin');
      const result = await authService.signIn(email, password);
      
      if (result.success) {
        const mockUser = authService.getCurrentUser();
        if (mockUser) {
          const supabaseUser = createSupabaseUser(mockUser);
          setUser(supabaseUser);
          setSession(createSupabaseSession(supabaseUser));
        }
      }
      
      return result;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to sign in' };
    }
  };

  const signOut = async () => {
    if (!supabase) {
      console.log('🎭 Using mock signout');
      authService.signOut();
      setUser(null);
      setSession(null);
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Note: When you're ready to use Supabase, replace this file with the full implementation
// that's currently in the SUPABASE_SETUP.md guide 