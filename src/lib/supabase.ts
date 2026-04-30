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
    clientInstance = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
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
