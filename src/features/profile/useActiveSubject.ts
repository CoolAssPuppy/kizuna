import { useContext } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import { ActiveSubjectContext, type ActiveSubject } from './ActiveSubjectContext';

interface UseActiveSubjectResult extends ActiveSubject {
  setSubject: (next: ActiveSubject | null) => void;
}

/**
 * Returns the currently-active subject (the user_id every per-section
 * write should target) plus a setter. Falls back to the signed-in
 * user when no provider is mounted or no override has been chosen, so
 * sections work in both wizard mode and profile mode without the
 * provider being mandatory.
 */
export function useActiveSubject(): UseActiveSubjectResult {
  const ctx = useContext(ActiveSubjectContext);
  const { user } = useAuth();

  const fallback: ActiveSubject = {
    userId: user?.id ?? '',
    displayName: user?.email ?? '',
    isDependent: false,
  };

  const subject = ctx?.subject ?? fallback;
  return {
    ...subject,
    setSubject: ctx?.setSubject ?? (() => undefined),
  };
}
