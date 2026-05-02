import type { AppSupabaseClient } from '@/lib/supabase';

import type { ApiKeyRow, ApiKeyScope, CreatedApiKey } from './types';

export async function listApiKeys(client: AppSupabaseClient): Promise<ApiKeyRow[]> {
  const { data, error } = await client
    .from('api_keys')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createApiKey(
  client: AppSupabaseClient,
  input: { name: string; scope: ApiKeyScope; expiresAt: string | null },
): Promise<CreatedApiKey> {
  const { data, error } = await client
    .rpc('create_api_key', {
      p_name: input.name,
      p_scope: input.scope,
      ...(input.expiresAt ? { p_expires_at: input.expiresAt } : {}),
    })
    .single();
  if (error) throw error;
  return { id: data.id, token: data.token };
}

export async function revokeApiKey(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('revoke_api_key', { p_id: id });
  if (error) throw error;
}
