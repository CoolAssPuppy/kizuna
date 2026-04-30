import { createContext, useContext } from 'react';

import type { ThemeId } from '@/lib/theme';

export interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
