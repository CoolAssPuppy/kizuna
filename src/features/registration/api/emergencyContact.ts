import type { AppSupabaseClient } from '@/lib/supabase';

import type { EmergencyContactRow } from '../types';

export async function saveEmergencyContact(
  client: AppSupabaseClient,
  userId: string,
  values: Pick<
    EmergencyContactRow,
    'full_name' | 'relationship' | 'phone_primary' | 'phone_secondary' | 'email' | 'notes'
  >,
): Promise<void> {
  const { error } = await client.from('emergency_contacts').upsert(
    {
      user_id: userId,
      full_name: values.full_name,
      relationship: values.relationship,
      phone_primary: values.phone_primary,
      phone_secondary: values.phone_secondary,
      email: values.email,
      notes: values.notes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadEmergencyContact(
  client: AppSupabaseClient,
  userId: string,
): Promise<EmergencyContactRow | null> {
  const { data, error } = await client
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
