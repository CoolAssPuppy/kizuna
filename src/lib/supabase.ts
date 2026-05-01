import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';
import type { Database } from '@/types/database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

let clientInstance: AppSupabaseClient | null = null;

/**
 * Returns the singleton browser Supabase client.
 *
 * The session persists in localStorage and refreshes automatically. Realtime
 * subscriptions and storage uploads share this connection.
 */
export function getSupabaseClient(): AppSupabaseClient {
  if (clientInstance === null) {
    clientInstance = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return clientInstance;
}

/** Reset the singleton, used by tests to inject mock clients. */
export function __resetSupabaseClientForTests(next: AppSupabaseClient | null = null): void {
  clientInstance = next;
}

/**
 * Supabase typegen sometimes resolves a 1-to-1 join (an aliased FK on a
 * table with multiple references to the same target) as `T[] | T | null`.
 * `flatJoin` flattens to a single record for the common case where the
 * relation is logically 1-to-1 — saves a layer of `as unknown as` casts.
 */
export type Joined<T> = T | T[] | null | undefined;
export function flatJoin<T>(rel: Joined<T>): T | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}
