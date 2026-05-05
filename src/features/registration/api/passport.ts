import type { AppSupabaseClient } from '@/lib/supabase';

import type { Database } from '@/types/database.types';

type PassportRow = Database['public']['Tables']['passport_details']['Row'];

export interface PassportInput {
  passportName: string;
  passportNumber: string;
  issuingCountry: string;
  expiryDate: string;
}

/**
 * Calls the security-definer RPC `set_passport` so the passport number is
 * encrypted at rest with pgcrypto. The plaintext never lands in a
 * client-readable column.
 *
 * Encryption key lives in Supabase Vault as `kizuna_passport_key`. Local
 * dev populates it via scripts/db-apply.sh; staging/prod via
 * scripts/reset-remote-db.sh (reads SB_PASSPORT_KEY from Doppler).
 */
export async function savePassport(
  client: AppSupabaseClient,
  userId: string,
  values: PassportInput,
): Promise<void> {
  const { error } = await client.rpc('set_passport', {
    p_user_id: userId,
    p_passport_name: values.passportName,
    p_passport_number: values.passportNumber,
    p_issuing_country: values.issuingCountry,
    p_expiry_date: values.expiryDate,
  });
  if (error) throw error;
}

/** Loads non-secret passport metadata. The number is never returned. */
export async function loadPassportMetadata(
  client: AppSupabaseClient,
  userId: string,
): Promise<Pick<PassportRow, 'passport_name' | 'issuing_country' | 'expiry_date'> | null> {
  const { data, error } = await client
    .from('passport_details')
    .select('passport_name, issuing_country, expiry_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
