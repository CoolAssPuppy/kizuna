import type { Database } from '@/types/database.types';

export type ApiKeyScope = Database['public']['Enums']['api_key_scope'];
export type ApiKeyRow = Database['public']['Tables']['api_keys']['Row'];

export interface CreatedApiKey {
  id: string;
  token: string;
}
