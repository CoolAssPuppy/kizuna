import { createContext, useState, type ReactNode } from 'react';

export interface ActiveSubject {
  /** user_id used for per-section data scoping. Defaults to the auth user; switches to a dependent's shadow user_id when the sponsor edits on their behalf. */
  userId: string;
  /** Display name shown in the profile header / section descriptions. */
  displayName: string;
  /** True when the active subject is a dependent rather than the signed-in user. */
  isDependent: boolean;
}

export interface ActiveSubjectContextValue {
  subject: ActiveSubject | null;
  setSubject: (next: ActiveSubject | null) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ActiveSubjectContext = createContext<ActiveSubjectContextValue | null>(null);

/**
 * Wraps the profile surface so any Section inside can read which user_id
 * to write against. The default is the signed-in user; the dependents
 * tab and the per-dependent profile selector replace it with the
 * dependent's shadow user_id (role='dependent') so the sponsor can fill
 * in dietary, accessibility, swag, passport, etc. on the dependent's
 * behalf.
 *
 * Sections that need this read it via `useActiveSubject()` (lives in
 * useActiveSubject.ts so eslint react-refresh stays happy).
 */
export function ActiveSubjectProvider({ children }: { children: ReactNode }): JSX.Element {
  const [subject, setSubject] = useState<ActiveSubject | null>(null);
  return (
    <ActiveSubjectContext.Provider value={{ subject, setSubject }}>
      {children}
    </ActiveSubjectContext.Provider>
  );
}
