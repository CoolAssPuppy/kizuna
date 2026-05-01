import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type FeedItemRow = Database['public']['Tables']['feed_items']['Row'];
export type FeedItemInsert = Database['public']['Tables']['feed_items']['Insert'];
export type FeedItemUpdate = Database['public']['Tables']['feed_items']['Update'];
export type FeedLocation = Database['public']['Enums']['feed_location'];

export async function fetchAllFeedItems(
  client: AppSupabaseClient,
  eventId: string,
): Promise<FeedItemRow[]> {
  const { data, error } = await client
    .from('feed_items')
    .select('*')
    .eq('event_id', eventId)
    .order('location', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createFeedItem(
  client: AppSupabaseClient,
  input: FeedItemInsert,
): Promise<FeedItemRow> {
  const { data, error } = await client.from('feed_items').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateFeedItem(
  client: AppSupabaseClient,
  id: string,
  patch: FeedItemUpdate,
): Promise<FeedItemRow> {
  const { data, error } = await client
    .from('feed_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFeedItem(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('feed_items').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Bulk-renumber positions inside one (event, location) bucket. Called
 * from the admin drag-to-reorder UI: pass the ordered list of ids.
 * Issues parallel updates so the round-trip is one network turn.
 */
export async function reorderFeedItems(
  client: AppSupabaseClient,
  args: { orderedIds: string[] },
): Promise<void> {
  await Promise.all(
    args.orderedIds.map((id, position) =>
      client.from('feed_items').update({ position }).eq('id', id),
    ),
  );
}
