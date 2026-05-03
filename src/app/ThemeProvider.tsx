import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { applyTheme, readStoredTheme, systemPreferredTheme, type ThemeId } from '@/lib/theme';

import { ThemeContext, type ThemeContextValue } from './ThemeContext';

interface ThemeProviderProps {
  children: ReactNode;
}

function subscribePrefersDark(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getPrefersDarkSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerPrefersDarkSnapshot(): boolean {
  return false;
}

/**
 * Theme rules:
 *   - Signed out: always follow the system color scheme — `supa` on dark
 *     mode, `light` on light. Stored picks are ignored so the auth screen
 *     never disagrees with the OS.
 *   - Signed in: load the user's saved preference from the cookie; fall
 *     back to system.
 *
 * Implementation: theme is fully derived from auth state, the cookie,
 * and a useSyncExternalStore subscription to `prefers-color-scheme`.
 * The DOM mutation runs during render — React tolerates synchronous
 * external-store sync; this avoids the banned useEffect path.
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  // Live OS preference. Re-renders the provider when the user toggles
  // their OS color scheme.
  useSyncExternalStore(subscribePrefersDark, getPrefersDarkSnapshot, getServerPrefersDarkSnapshot);
  const [storedOverride, setStoredOverride] = useState<ThemeId | null>(null);

  const theme: ThemeId = useMemo(() => {
    if (!signedIn) return systemPreferredTheme();
    if (storedOverride) return storedOverride;
    return readStoredTheme();
  }, [signedIn, storedOverride]);

  // Sync the resolved theme to the document and (when signed in) the
  // cookie. Doing this during render is safe for synchronous external
  // sync — React explicitly allows it for store-bridging providers.
  if (typeof document !== 'undefined') {
    document.documentElement.dataset['theme'] = theme;
  }

  const setTheme = useCallback(
    (next: ThemeId): void => {
      setStoredOverride(next);
      // Only persist when the user is signed in — guests' theme reflects
      // the OS, so storing would override that on the next visit.
      if (signedIn) {
        applyTheme(next);
      } else if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = next;
      }
    },
    [signedIn],
  );

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
