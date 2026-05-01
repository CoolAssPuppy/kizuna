import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SwagSizeRow = Database['public']['Tables']['swag_sizes']['Row'];

export interface SwagSizeInput {
  tshirtSize: string | null;
  /** Canonical EU shoe size. UI converts US ↔ EU; storage is always EU. */
  shoeSizeEu: number | null;
}

export async function loadSelfSwagSize(
  client: AppSupabaseClient,
  userId: string,
): Promise<SwagSizeRow | null> {
  const { data, error } = await client
    .from('swag_sizes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function loadAdditionalGuestSwagSizes(
  client: AppSupabaseClient,
  sponsorId: string,
): Promise<SwagSizeRow[]> {
  const { data, error } = await client
    .from('swag_sizes')
    .select('*, additional_guests!inner(sponsor_id)')
    .eq('additional_guests.sponsor_id', sponsorId);
  if (error) throw error;
  return data ?? [];
}

export async function saveSelfSwagSize(
  client: AppSupabaseClient,
  userId: string,
  input: SwagSizeInput,
): Promise<void> {
  const { error } = await client
    .from('swag_sizes')
    .upsert(
      {
        user_id: userId,
        additional_guest_id: null,
        tshirt_size: input.tshirtSize,
        shoe_size_eu: input.shoeSizeEu,
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

export async function saveAdditionalGuestSwagSize(
  client: AppSupabaseClient,
  additionalGuestId: string,
  input: SwagSizeInput,
): Promise<void> {
  const { error } = await client
    .from('swag_sizes')
    .upsert(
      {
        user_id: null,
        additional_guest_id: additionalGuestId,
        tshirt_size: input.tshirtSize,
        shoe_size_eu: input.shoeSizeEu,
      },
      { onConflict: 'additional_guest_id' },
    );
  if (error) throw error;
}
