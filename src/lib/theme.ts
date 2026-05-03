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
export const THEME_COOKIE_NAME = 'kizuna_theme';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (SUPPORTED_THEMES as ReadonlyArray<string>).includes(value);
}

/**
 * Picks the system-preferred default. Dark mode users land on `supa`
 * (the Supabase brand on #121212), light mode users on `light`. Used
 * as the initial theme when no choice has been persisted.
 */
export function systemPreferredTheme(): ThemeId {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'supa' : 'light';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of cookies) {
    const idx = c.indexOf('=');
    if (idx === -1) continue;
    if (c.slice(0, idx) === name) {
      return decodeURIComponent(c.slice(idx + 1));
    }
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * Reads the saved theme from the `kizuna_theme` cookie. Falls back to
 * the system-preferred default when nothing is saved so first-load
 * auth screens match the user's OS appearance.
 *
 * The legacy `'dark'` value is migrated to `'supa'` on read — they
 * share a palette and we collapsed the two when the visual identity
 * settled on the Supabase #121212 surface.
 */
export function readStoredTheme(): ThemeId {
  const stored = readCookie(THEME_COOKIE_NAME);
  if (stored === 'dark') {
    writeCookie(THEME_COOKIE_NAME, 'supa');
    return 'supa';
  }
  return isThemeId(stored) ? stored : systemPreferredTheme();
}

/** Persists the theme to a cookie and applies it to the document element. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset['theme'] = theme;
  writeCookie(THEME_COOKIE_NAME, theme);
}
