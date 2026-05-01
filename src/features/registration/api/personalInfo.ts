import type { AppSupabaseClient } from '@/lib/supabase';

import type { EmployeeProfileRow } from '../types';

export async function savePersonalInfo(
  client: AppSupabaseClient,
  userId: string,
  values: Pick<EmployeeProfileRow, 'preferred_name' | 'legal_name' | 'base_city'>,
): Promise<void> {
  const { error } = await client.from('employee_profiles').upsert(
    {
      user_id: userId,
      preferred_name: values.preferred_name,
      legal_name: values.legal_name,
      base_city: values.base_city,
      legal_name_source: 'user_entered',
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadPersonalInfo(
  client: AppSupabaseClient,
  userId: string,
): Promise<EmployeeProfileRow | null> {
  const { data, error } = await client
    .from('employee_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
