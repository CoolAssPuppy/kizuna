/**
 * Theme tokens.
 *
 * Five themes ship: light (default Supabase brand), supa (Supabase
 * brand on #121212 — the dark mode), barbie (pink, playful), hermione
 * (Gryffindor red + gold on dark academia), and kirk (60s Star Trek
 * pop). Each is selected by setting `data-theme="<name>"` on the html
 * element. globals.css holds the matching CSS variable definitions.
 */

export type ThemeId = 'light' | 'barbie' | 'supa' | 'hermione' | 'kirk';

export const SUPPORTED_THEMES: ReadonlyArray<ThemeId> = [
  'light',
  'supa',
  'barbie',
  'hermione',
  'kirk',
];
export const DEFAULT_THEME: ThemeId = 'light';
export const THEME_STORAGE_KEY = 'kizuna.theme';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (SUPPORTED_THEMES as ReadonlyArray<string>).includes(value);
}

/**
 * Reads a saved theme from localStorage. Falls back to DEFAULT_THEME.
 * The legacy `'dark'` value is migrated to `'supa'` on read — they
 * share a palette and we collapsed the two when the visual identity
 * settled on the Supabase #121212 surface.
 */
export function readStoredTheme(): ThemeId {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark') {
    localStorage.setItem(THEME_STORAGE_KEY, 'supa');
    return 'supa';
  }
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
