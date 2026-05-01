/**
 * Typed accessor for client-side env vars.
 *
 * Required vars log a loud warning at boot when missing, then fall back
 * to placeholder strings so the SPA still mounts. The previous behaviour
 * was to throw at module load; that turned every deploy preview, e2e
 * runner, or PR build without a `.env` into a white-screen-of-death and
 * masked the underlying configuration error. Failing softly + warning
 * loudly lets the welcome / 404 screens render without a backend, while
 * any real Supabase call still fails fast with a real error message.
 *
 * Server-only secrets (service role, integration credentials) MUST NOT
 * be read here. Those live in `supabase/functions/.env` and are
 * accessed inside edge functions.
 */

const PLACEHOLDER_SUPABASE_URL = 'http://127.0.0.1:54321';
const PLACEHOLDER_SUPABASE_KEY = 'placeholder-publishable-key';

function readEnv(key: keyof ImportMetaEnv, fallback: string): string {
  const value: unknown = import.meta.env[key];
  if (typeof value === 'string' && value.length > 0) return value;
  // Single warning per missing key. Using console.error so it's visible
  // in production logs too, not just dev consoles.
  console.error(
    `[kizuna] Missing required env var: ${key}. Falling back to a placeholder; Supabase calls will fail until this is set.`,
  );
  return fallback;
}

export const env = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL', PLACEHOLDER_SUPABASE_URL),
  supabasePublishableKey: readEnv('VITE_SUPABASE_PUBLISHABLE_KEY', PLACEHOLDER_SUPABASE_KEY),
} as const;
