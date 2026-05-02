import type { AppSupabaseClient } from '@/lib/supabase';
import { SELECT_SESSIONS_BASE } from '@/lib/supabase/columns';
import type { Database } from '@/types/database.types';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['sessions']['Update'];
export type SessionType = Database['public']['Enums']['session_type'];
export type SessionAudience = Database['public']['Enums']['session_audience'];

export async function fetchAllSessions(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SessionRow[]> {
  const { data, error } = await client
    .from('sessions')
    .select(SELECT_SESSIONS_BASE)
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSession(
  client: AppSupabaseClient,
  input: SessionInsert,
): Promise<SessionRow> {
  const { data, error } = await client.from('sessions').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateSession(
  client: AppSupabaseClient,
  id: string,
  patch: SessionUpdate,
): Promise<SessionRow> {
  const { data, error } = await client
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('sessions').delete().eq('id', id);
  if (error) throw error;
}
