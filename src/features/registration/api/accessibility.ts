import type { AppSupabaseClient } from '@/lib/supabase';

import type { Database } from '@/types/database.types';

export type AccessibilityRow = Database['public']['Tables']['accessibility_preferences']['Row'];

export async function loadAccessibility(
  client: AppSupabaseClient,
  userId: string,
): Promise<AccessibilityRow | null> {
  const { data, error } = await client
    .from('accessibility_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveAccessibility(
  client: AppSupabaseClient,
  userId: string,
  values: { needs: string[]; notes: string | null },
): Promise<void> {
  const { error } = await client.from('accessibility_preferences').upsert(
    {
      user_id: userId,
      needs: values.needs,
      notes: values.notes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
