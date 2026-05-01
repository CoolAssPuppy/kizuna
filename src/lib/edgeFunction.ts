import type { AppSupabaseClient } from '@/lib/supabase';

/**
 * Wraps `client.functions.invoke` with consistent error handling and a
 * non-null payload guarantee. Supabase types `data` and `error` as
 * `unknown`, so funnelling every call through this helper keeps the
 * call sites typed without stray `as` casts.
 */
export async function callEdgeFunction<T>(
  client: AppSupabaseClient,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await client.functions.invoke<T>(name, { body });
  if (response.error) {
    throw response.error instanceof Error
      ? response.error
      : new Error(String(response.error));
  }
  if (response.data === null || response.data === undefined) {
    throw new Error(`${name} returned no payload`);
  }
  return response.data;
}
