import { createContext, useState, type ReactNode } from 'react';

export interface ActiveSubject {
  /** user_id used for per-section data scoping. */
  userId: string;
  displayName: string;
  /** True when the active subject is a dependent rather than the signed-in user. */
  isDependent: boolean;
}

export interface ActiveSubjectContextValue {
  /** Null until the sponsor explicitly switches subject via the selector. */
  override: ActiveSubject | null;
  setSubject: (next: ActiveSubject | null) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ActiveSubjectContext = createContext<ActiveSubjectContextValue | null>(null);

export function ActiveSubjectProvider({ children }: { children: ReactNode }): JSX.Element {
  // Store ONLY the explicit override. The hook resolves the effective
  // subject from `override ?? auth.user`, so a late-arriving auth
  // hydration is picked up automatically without a re-init pass.
  const [override, setSubject] = useState<ActiveSubject | null>(null);
  return (
    <ActiveSubjectContext.Provider value={{ override, setSubject }}>
      {children}
    </ActiveSubjectContext.Provider>
  );
}
