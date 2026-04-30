import type { AppSupabaseClient } from '@/lib/supabase';

import type { ItineraryItemRow } from './types';

interface FetchArgs {
  userId: string;
  eventId: string;
}

/**
 * Loads every itinerary row for the user/event ordered ascending by start.
 * itinerary_items is materialised by triggers, so this is a single
 * non-joining query suitable for offline cache (M1 db trigger work).
 */
export async function fetchItinerary(
  client: AppSupabaseClient,
  { userId, eventId }: FetchArgs,
): Promise<ItineraryItemRow[]> {
  const { data, error } = await client
    .from('itinerary_items')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Loads the registration row to expose the QR check-in token.
 * Returned as the row so callers can also surface completion_pct etc.
 */
export async function fetchRegistrationForCheckin(
  client: AppSupabaseClient,
  { userId, eventId }: FetchArgs,
): Promise<{ qrToken: string | null; completionPct: number } | null> {
  const { data, error } = await client
    .from('registrations')
    .select('qr_token, completion_pct')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { qrToken: data.qr_token, completionPct: data.completion_pct };
}
