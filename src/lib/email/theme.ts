/**
 * Shared email theme tokens.
 *
 * Email clients are not browsers — they support a tiny subset of CSS,
 * mostly inline. Keeping the palette in one place means designers and
 * engineers only edit one file when the brand evolves.
 *
 * The theme is the Supabase dark theme: near-black background, white
 * text, green accents. Matches `[data-theme='dark']` in
 * src/styles/globals.css.
 */

export const emailTheme = {
  colors: {
    background: '#1c1c1c',
    surface: '#202020',
    surfaceMuted: '#262626',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    border: '#2d2d2d',
    primary: '#3ECF8E',
    primaryHover: '#34b97c',
    primaryText: '#0a0a0c',
  },
  fonts: {
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  },
  spacing: {
    radius: '10px',
    pad: '24px',
  },
} as const;

export type EmailTheme = typeof emailTheme;
