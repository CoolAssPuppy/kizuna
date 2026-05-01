import { createContext, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

export interface ActiveSubject {
  /** user_id used for per-section data scoping. */
  userId: string;
  displayName: string;
  /** True when the active subject is a dependent rather than the signed-in user. */
  isDependent: boolean;
}

export interface ActiveSubjectContextValue {
  subject: ActiveSubject;
  setSubject: (next: ActiveSubject) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ActiveSubjectContext = createContext<ActiveSubjectContextValue | null>(null);

export function ActiveSubjectProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();
  const [subject, setSubject] = useState<ActiveSubject>({
    userId: user?.id ?? '',
    displayName: user?.email ?? '',
    isDependent: false,
  });
  return (
    <ActiveSubjectContext.Provider value={{ subject, setSubject }}>
      {children}
    </ActiveSubjectContext.Provider>
  );
}
