/**
 * Theme tokens.
 *
 * Three themes ship: light (default Supabase), dark (Supabase inverted),
 * and barbie (pink, playful). Each is selected by setting
 * `data-theme="<name>"` on the html element. globals.css holds the
 * matching CSS variable definitions.
 */

export type ThemeId = 'light' | 'dark' | 'barbie';

export const SUPPORTED_THEMES: ReadonlyArray<ThemeId> = ['light', 'dark', 'barbie'];
export const DEFAULT_THEME: ThemeId = 'light';
export const THEME_STORAGE_KEY = 'kizuna.theme';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (SUPPORTED_THEMES as ReadonlyArray<string>).includes(value);
}

/** Reads a saved theme from localStorage. Falls back to DEFAULT_THEME. */
export function readStoredTheme(): ThemeId {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
}

/** Persists the theme and applies it to the document element. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset['theme'] = theme;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}
