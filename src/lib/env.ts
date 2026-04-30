/**
 * Typed accessor for client-side env vars.
 *
 * Required vars throw at boot if missing (loud failure beats silent misconfig).
 * Optional integration vars return undefined and the calling code degrades gracefully.
 *
 * Server-only secrets (service role, integration credentials) MUST NOT be read here.
 * Those live in `supabase/functions/.env` and are accessed inside edge functions.
 */

function requireEnv(key: keyof ImportMetaEnv): string {
  const value: unknown = import.meta.env[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Missing required env var: ${key}. Copy .env.example to .env and run \`supabase start\`.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabasePublishableKey: requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
} as const;
