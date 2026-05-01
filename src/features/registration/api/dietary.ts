import type { AppSupabaseClient } from '@/lib/supabase';

import type { DietaryRow } from '../types';

export async function saveDietary(
  client: AppSupabaseClient,
  userId: string,
  values: Pick<DietaryRow, 'restrictions' | 'allergies' | 'alcohol_free' | 'severity' | 'notes'>,
): Promise<void> {
  const { error } = await client.from('dietary_preferences').upsert(
    {
      user_id: userId,
      restrictions: values.restrictions,
      allergies: values.allergies,
      alcohol_free: values.alcohol_free,
      severity: values.severity,
      notes: values.notes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadDietary(
  client: AppSupabaseClient,
  userId: string,
): Promise<DietaryRow | null> {
  const { data, error } = await client
    .from('dietary_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
