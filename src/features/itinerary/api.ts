import type { AppSupabaseClient } from '@/lib/supabase';

import type { ItineraryItemRow } from './types';

interface FetchArgs {
  userId: string;
  eventId: string;
}

interface GuestSyncRow {
  syncs_with_sponsor: boolean;
  sponsor_id: string;
}

/**
 * Reads guest_profiles to discover whether the current user is a guest
 * who has opted into mirroring their sponsor's itinerary. Returns null
 * for non-guest users (no row exists in guest_profiles).
 */
export async function fetchGuestSyncState(
  client: AppSupabaseClient,
  userId: string,
): Promise<GuestSyncRow | null> {
  const { data, error } = await client
    .from('guest_profiles')
    .select('syncs_with_sponsor, sponsor_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setGuestSync(
  client: AppSupabaseClient,
  userId: string,
  next: boolean,
): Promise<void> {
  const { error } = await client
    .from('guest_profiles')
    .update({ syncs_with_sponsor: next })
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Loads every itinerary row for the user/event ordered ascending by
 * start. itinerary_items is materialised by triggers, so this is a
 * single non-joining query suitable for offline cache.
 *
 * For guests with syncs_with_sponsor=true, the query targets the
 * sponsor's user_id instead — RLS lets them read those rows. The
 * canonical employee view is unaffected.
 */
export async function fetchItinerary(
  client: AppSupabaseClient,
  { userId, eventId }: FetchArgs,
): Promise<ItineraryItemRow[]> {
  const sync = await fetchGuestSyncState(client, userId);
  const targetUserId = sync?.syncs_with_sponsor ? sync.sponsor_id : userId;

  const { data, error } = await client
    .from('itinerary_items')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
