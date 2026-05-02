import type { AppSupabaseClient } from '@/lib/supabase';

import type { AdditionalGuestRow } from '../types';

/**
 * Editable subset of an additional_guests row. Minor rows are created
 * through the Invite-a-Guest dialog (which captures age_bracket and
 * fee_amount). Once created, only these fields are editable: changing
 * age_bracket would shift the fee and break Stripe reconciliation.
 */
export interface AdditionalGuestInput {
  id: string;
  first_name: string;
  last_name: string;
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
    .order('last_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Replace strategy: delete rows missing from the new list, update the
 * remaining rows in place. Avoids diff-management complexity in the UI
 * for what is rarely more than a handful of records.
 */
export async function saveAdditionalGuests(
  client: AppSupabaseClient,
  userId: string,
  rows: AdditionalGuestInput[],
): Promise<void> {
  const existing = await loadAdditionalGuests(client, userId);
  const keepIds = rows.map((r) => r.id);
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

  for (const row of rows) {
    const { error } = await client
      .from('additional_guests')
      .update({
        first_name: row.first_name,
        last_name: row.last_name,
        special_needs: row.special_needs,
        notes: row.notes,
      })
      .eq('id', row.id);
    if (error) throw error;
  }
}
