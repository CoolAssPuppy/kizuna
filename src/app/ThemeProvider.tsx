import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import { applyTheme, DEFAULT_THEME, readStoredTheme, type ThemeId } from '@/lib/theme';

import { ThemeContext, type ThemeContextValue } from './ThemeContext';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // localStorage isn't available during SSR, so we hydrate after mount.
  useMountEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  });

  const setTheme = useCallback((next: ThemeId): void => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
