import { useCallback, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';

import { AuthContext } from './AuthContext';
import { signInWithSso as performSsoSignIn } from './sso';
import type { AppUser, AuthContextValue, AuthState } from './types';

type Action =
  | { type: 'session'; user: AuthState['user']; supabaseUser: AuthState['supabaseUser'] }
  | { type: 'cleared' }
  | { type: 'error'; error: Error };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'session':
      return {
        status: action.user ? 'authenticated' : 'unauthenticated',
        user: action.user,
        supabaseUser: action.supabaseUser,
        error: null,
      };
    case 'cleared':
      return { status: 'unauthenticated', user: null, supabaseUser: null, error: null };
    case 'error':
      return { ...state, status: 'unauthenticated', error: action.error };
  }
}

const initialState: AuthState = {
  status: 'loading',
  user: null,
  supabaseUser: null,
  error: null,
};

interface AuthProviderProps {
  children: ReactNode;
  /** SSO config injected so tests can override without env access. */
  ssoConfig?: {
    oktaDomain?: string | undefined;
    oktaClientId?: string | undefined;
  };
}

export function AuthProvider({ children, ssoConfig = {} }: AuthProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const supabase = useMemo(() => getSupabaseClient(), []);

  const loadAppUser = useCallback(
    async (supabaseUserId: string): Promise<AppUser | null> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, is_active, is_leadership')
        .eq('id', supabaseUserId)
        .maybeSingle();

      if (error) {
        // Surface to the AuthState so the UI can show a meaningful message
        // rather than getting stuck in a redirect loop with no app user row.
        dispatch({ type: 'error', error: new Error(error.message) });
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        email: data.email,
        role: data.role,
        isActive: data.is_active,
        isLeadership: data.is_leadership,
      };
    },
    [supabase],
  );

  // Unmount guard ref. The effect flips it on cleanup so the
  // syncSession callback (memoised below) can refuse to dispatch
  // after we've torn down the provider.
  const activeRef = useRef(true);

  const syncSession = useCallback(
    async (session: Session | null): Promise<void> => {
      if (!session) {
        if (activeRef.current) dispatch({ type: 'cleared' });
        return;
      }
      const appUser = await loadAppUser(session.user.id);
      if (!activeRef.current) return;
      dispatch({ type: 'session', user: appUser, supabaseUser: session.user });
    },
    [loadAppUser],
  );

  useMountEffect(() => {
    activeRef.current = true;
    // onAuthStateChange fires INITIAL_SESSION on subscribe, so a
    // manual getSession() here would race against it. Lean on the
    // listener exclusively.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });
    return () => {
      activeRef.current = false;
      subscription.subscription.unsubscribe();
    };
  });

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        dispatch({ type: 'error', error });
        throw error;
      }
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        dispatch({ type: 'error', error });
        throw error;
      }
    },
    [supabase],
  );

  const signInWithSso = useCallback(async (): Promise<void> => {
    try {
      await performSsoSignIn(supabase, ssoConfig);
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      dispatch({ type: 'error', error: wrapped });
      throw wrapped;
    }
  }, [supabase, ssoConfig]);

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      dispatch({ type: 'error', error });
      throw error;
    }
    // No manual dispatch — onAuthStateChange fires SIGNED_OUT and the
    // listener clears state for us. Avoids a double dispatch.
  }, [supabase]);

  const value: AuthContextValue = useMemo(
    () => ({
      ...state,
      signInWithPassword,
      signUpWithPassword,
      signInWithSso,
      signOut,
    }),
    [state, signInWithPassword, signUpWithPassword, signInWithSso, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
