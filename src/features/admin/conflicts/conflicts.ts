import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type DataConflictRow = Database['public']['Tables']['data_conflicts']['Row'];

export async function fetchOpenConflicts(client: AppSupabaseClient): Promise<DataConflictRow[]> {
  const { data, error } = await client
    .from('data_conflicts')
    .select('*')
    .eq('status', 'open')
    .order('detected_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolveConflict(
  client: AppSupabaseClient,
  conflictId: string,
  resolution: 'accepted_kizuna' | 'accepted_external',
  resolutionNote: string | null,
): Promise<void> {
  const { error } = await client
    .from('data_conflicts')
    .update({
      status: resolution,
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote,
    })
    .eq('id', conflictId);
  if (error) throw error;
}
