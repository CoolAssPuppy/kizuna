// Shared Supabase client construction for edge functions.
//
// Every edge function that needs a service-role admin client repeats
// the same boilerplate. Centralising it here ensures the env var
// fallbacks (SUPABASE_SECRET_KEY → SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_PUBLISHABLE_KEY → SUPABASE_ANON_KEY) live in one place.

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
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** User-scoped client that runs through RLS as the caller. Pass the request's Authorization header. */
export function getUserClient(authHeader: string | null): SupabaseClient {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
