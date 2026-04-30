import type { User } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

export type AppRole = Database['public']['Enums']['user_role'];

export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
  isActive: boolean;
}

export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AppUser | null;
  supabaseUser: User | null;
  error: Error | null;
}

export interface AuthActions {
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithSso: () => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface AuthContextValue extends AuthState, AuthActions {}
