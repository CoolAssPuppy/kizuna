import type { AppSupabaseClient } from '@/lib/supabase';

import type { Database } from '@/types/database.types';

type SwagItemRow = Database['public']['Tables']['swag_items']['Row'];
type SwagSelectionRow = Database['public']['Tables']['swag_selections']['Row'];

export interface SwagSelectionInput {
  swagItemId: string;
  optedIn: boolean;
  size: string | null;
  fitPreference: 'fitted' | 'relaxed' | null;
}

export async function loadSwagCatalogue(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SwagItemRow[]> {
  const { data, error } = await client
    .from('swag_items')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function loadSwagSelections(
  client: AppSupabaseClient,
  userId: string,
): Promise<SwagSelectionRow[]> {
  const { data, error } = await client.from('swag_selections').select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function saveSwagSelections(
  client: AppSupabaseClient,
  userId: string,
  selections: SwagSelectionInput[],
): Promise<void> {
  if (selections.length === 0) return;
  const rows = selections.map((s) => ({
    user_id: userId,
    swag_item_id: s.swagItemId,
    opted_in: s.optedIn,
    size: s.size,
    fit_preference: s.fitPreference,
  }));
  const { error } = await client
    .from('swag_selections')
    .upsert(rows, { onConflict: 'user_id,swag_item_id' });
  if (error) throw error;
}
