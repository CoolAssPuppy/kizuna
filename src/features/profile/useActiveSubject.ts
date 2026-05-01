import { useContext, useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import { ActiveSubjectContext, type ActiveSubject } from './ActiveSubjectContext';

interface UseActiveSubjectResult extends ActiveSubject {
  setSubject: (next: ActiveSubject | null) => void;
}

const NOOP_SET = (): void => undefined;

/**
 * Returns the active subject (defaults to the signed-in user) and a
 * setter. Effective subject = explicit override ?? auth user, so a
 * late auth hydration flows through without re-initialising the
 * provider, and consumers depending on object identity get a stable
 * reference until inputs change.
 */
export function useActiveSubject(): UseActiveSubjectResult {
  const ctx = useContext(ActiveSubjectContext);
  const { user } = useAuth();
  const override = ctx?.override ?? null;
  const setSubject = ctx?.setSubject ?? NOOP_SET;

  return useMemo<UseActiveSubjectResult>(() => {
    if (override) return { ...override, setSubject };
    return {
      userId: user?.id ?? '',
      displayName: user?.email ?? '',
      isDependent: false,
      setSubject,
    };
  }, [override, user?.id, user?.email, setSubject]);
}
