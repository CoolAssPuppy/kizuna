/**
 * Post-SSO HiBob hydration call.
 *
 * After the Okta dance completes, the SPA invokes the `hibob-self`
 * edge function with the user's session JWT. The function looks up the
 * caller in HiBob and upserts their employee_profiles + swag_sizes
 * row. The SPA only cares whether hydration succeeded — the actual
 * payload is consumed by the registration wizard via a fresh database
 * read, not by passing the response in memory (so a wizard re-render
 * after a navigation still sees the latest values).
 *
 * Failures are non-fatal: the wizard is the user's chance to fill in
 * anything HiBob did not have. We log the error and continue.
 */

import { callEdgeFunction } from '@/lib/edgeFunction';
import type { AppSupabaseClient } from '@/lib/supabase';

interface HibobSelfResult {
  found: boolean;
}

export async function hydrateFromHiBob(client: AppSupabaseClient): Promise<HibobSelfResult> {
  try {
    return await callEdgeFunction<HibobSelfResult>(client, 'hibob-self', {});
  } catch (err) {
    console.warn('[kizuna] HiBob hydration failed, continuing without it:', err);
    return { found: false };
  }
}
