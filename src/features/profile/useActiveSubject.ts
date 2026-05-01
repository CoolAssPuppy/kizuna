import { useContext } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import { ActiveSubjectContext, type ActiveSubject } from './ActiveSubjectContext';

interface UseActiveSubjectResult extends ActiveSubject {
  setSubject: (next: ActiveSubject) => void;
}

/**
 * Returns the active subject (defaults to the signed-in user) and a
 * setter. Falls back to the auth user when no provider is mounted, so
 * sections work in wizard mode without the provider.
 */
export function useActiveSubject(): UseActiveSubjectResult {
  const ctx = useContext(ActiveSubjectContext);
  const { user } = useAuth();
  if (ctx) return { ...ctx.subject, setSubject: ctx.setSubject };
  return {
    userId: user?.id ?? '',
    displayName: user?.email ?? '',
    isDependent: false,
    setSubject: () => undefined,
  };
}
