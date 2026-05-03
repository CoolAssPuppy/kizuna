import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  isThemeId,
  readStoredTheme,
  SUPPORTED_THEMES,
  systemPreferredTheme,
  THEME_COOKIE_NAME,
} from './theme';

function clearThemeCookie(): void {
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

function mockMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('dark') ? prefersDark : !prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('isThemeId', () => {
  it('accepts every supported theme', () => {
    for (const theme of SUPPORTED_THEMES) {
      expect(isThemeId(theme)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isThemeId('chartreuse')).toBe(false);
    expect(isThemeId('')).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });
});

describe('systemPreferredTheme', () => {
  beforeEach(() => clearThemeCookie());
  afterEach(() => clearThemeCookie());

  it('returns supa when the OS reports dark mode', () => {
    mockMatchMedia(true);
    expect(systemPreferredTheme()).toBe('supa');
  });

  it('returns light when the OS reports light mode', () => {
    mockMatchMedia(false);
    expect(systemPreferredTheme()).toBe('light');
  });
});

describe('readStoredTheme', () => {
  beforeEach(() => clearThemeCookie());
  afterEach(() => clearThemeCookie());

  it('falls back to the system preference when no cookie is set', () => {
    mockMatchMedia(true);
    expect(readStoredTheme()).toBe('supa');
    mockMatchMedia(false);
    expect(readStoredTheme()).toBe('light');
  });

  it('returns the saved theme when the cookie is set', () => {
    document.cookie = `${THEME_COOKIE_NAME}=barbie; Path=/`;
    expect(readStoredTheme()).toBe('barbie');
  });

  it('migrates the legacy "dark" value to "supa"', () => {
    document.cookie = `${THEME_COOKIE_NAME}=dark; Path=/`;
    expect(readStoredTheme()).toBe('supa');
    // Migration also rewrites the cookie to the canonical value.
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=supa`);
  });

  it('falls back to the system preference for an unknown saved value', () => {
    document.cookie = `${THEME_COOKIE_NAME}=cyberpunk; Path=/`;
    mockMatchMedia(false);
    expect(readStoredTheme()).toBe('light');
  });
});

describe('applyTheme', () => {
  beforeEach(() => clearThemeCookie());
  afterEach(() => clearThemeCookie());

  it('writes the theme to the document and the cookie', () => {
    applyTheme('hermione');
    expect(document.documentElement.dataset['theme']).toBe('hermione');
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=hermione`);
  });
});
