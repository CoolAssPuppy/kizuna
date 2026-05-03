import type { AppSupabaseClient } from '@/lib/supabase';

type ReorderableTable = 'feed_items' | 'session_tags';

// Each id gets its array index as its new `position`. Issued in
// parallel so the round-trip is one network turn.
export async function reorderRowsByPosition(
  client: AppSupabaseClient,
  table: ReorderableTable,
  orderedIds: ReadonlyArray<string>,
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, position) =>
      client.from(table).update({ position }).eq('id', id),
    ),
  );
}
