import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['sessions']['Update'];
export type SessionType = Database['public']['Enums']['session_type'];
export type SessionAudience = Database['public']['Enums']['session_audience'];
export type SessionStatus = Database['public']['Enums']['session_status'];

export async function fetchAllSessions(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SessionRow[]> {
  const { data, error } = await client
    .from('sessions')
    .select('*')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true, nullsFirst: false });
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
