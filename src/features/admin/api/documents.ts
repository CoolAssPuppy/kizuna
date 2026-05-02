import type { AppSupabaseClient } from '@/lib/supabase';
import { SELECT_DOCUMENTS_BASE } from '@/lib/supabase/columns';
import type { Database } from '@/types/database.types';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
export type DocumentContentType = Database['public']['Enums']['document_content_type'];

export async function fetchAllDocuments(
  client: AppSupabaseClient,
  eventId: string,
): Promise<DocumentRow[]> {
  const { data, error } = await client
    .from('documents')
    .select(SELECT_DOCUMENTS_BASE)
    .or(`event_id.eq.${eventId},event_id.is.null`)
    .order('display_order', { ascending: true })
    .order('document_key', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createDocument(
  client: AppSupabaseClient,
  input: DocumentInsert,
): Promise<DocumentRow> {
  const { data, error } = await client.from('documents').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateDocument(
  client: AppSupabaseClient,
  id: string,
  patch: DocumentUpdate,
): Promise<DocumentRow> {
  const { data, error } = await client
    .from('documents')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('documents').delete().eq('id', id);
  if (error) throw error;
}
