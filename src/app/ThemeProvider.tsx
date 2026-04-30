import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { applyTheme, DEFAULT_THEME, readStoredTheme, type ThemeId } from '@/lib/theme';

import { ThemeContext, type ThemeContextValue } from './ThemeContext';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Hydrate from localStorage on mount. Doing this in an effect avoids the
  // SSR / hydration mismatch trap (the server has no localStorage).
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((next: ThemeId): void => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
