// Shared Supabase client construction for edge functions.
//
// Supabase Cloud auto-injects SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// and SUPABASE_ANON_KEY into every edge function's runtime — those
// names are owned by the platform and we never set them ourselves.
//
// For local dev (`supabase functions serve` reads supabase/.env that
// Doppler exports), the platform names aren't auto-set, so we fall
// back to SB_SECRET_KEY / SB_PUBLISHABLE_KEY (Doppler reserves the
// SUPABASE_ prefix for its native sync).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

declare const Deno: { env: { get: (k: string) => string | undefined } };

function requireEnv(name: string, ...fallbacks: string[]): string {
  for (const candidate of [name, ...fallbacks]) {
    const value = Deno.env.get(candidate);
    if (value) return value;
  }
  throw new Error(`Missing env var: ${name}`);
}

/** Service-role client for admin operations. Never call from a path the user can reach without an admin guard. */
export function getAdminClient(): SupabaseClient {
  const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'SB_SECRET_KEY');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** User-scoped client that runs through RLS as the caller. Pass the request's Authorization header. */
export function getUserClient(authHeader: string | null): SupabaseClient {
  const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY', 'SB_PUBLISHABLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY');
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
