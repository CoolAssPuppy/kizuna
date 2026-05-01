import type { AppSupabaseClient } from '@/lib/supabase';

import type { AdditionalGuestRow } from '../types';

export interface AdditionalGuestInput {
  id?: string;
  full_name: string;
  age: number;
  special_needs: string[];
  notes: string | null;
}

export async function loadAdditionalGuests(
  client: AppSupabaseClient,
  userId: string,
): Promise<AdditionalGuestRow[]> {
  const { data, error } = await client
    .from('additional_guests')
    .select('*')
    .eq('sponsor_id', userId)
    .order('age', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Replace strategy: delete rows missing from the new list, upsert the
 * provided rows. Avoids diff-management complexity in the UI for what
 * is rarely more than a handful of records.
 */
export async function saveAdditionalGuests(
  client: AppSupabaseClient,
  userId: string,
  rows: AdditionalGuestInput[],
): Promise<void> {
  const existing = await loadAdditionalGuests(client, userId);
  const keepIds = rows.map((r) => r.id).filter((id): id is string => Boolean(id));
  const toDelete = existing.filter((row) => !keepIds.includes(row.id));

  if (toDelete.length > 0) {
    const { error } = await client
      .from('additional_guests')
      .delete()
      .in(
        'id',
        toDelete.map((r) => r.id),
      );
    if (error) throw error;
  }

  if (rows.length === 0) return;

  const upsertRows = rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    sponsor_id: userId,
    full_name: row.full_name,
    age: row.age,
    special_needs: row.special_needs,
    notes: row.notes,
  }));
  const { error } = await client
    .from('additional_guests')
    .upsert(upsertRows, { onConflict: 'id' });
  if (error) throw error;
}
