import type { AppSupabaseClient } from '@/lib/supabase';

import type { EmployeeProfileRow } from '../types';

export type PersonalInfoValues = Pick<
  EmployeeProfileRow,
  | 'preferred_name'
  | 'first_name'
  | 'middle_initial'
  | 'last_name'
  | 'legal_name'
  | 'base_city'
  | 'alternate_email'
  | 'phone_number'
  | 'whatsapp'
>;

export async function savePersonalInfo(
  client: AppSupabaseClient,
  userId: string,
  values: PersonalInfoValues,
): Promise<void> {
  const { error } = await client.from('employee_profiles').upsert(
    {
      user_id: userId,
      preferred_name: values.preferred_name,
      first_name: values.first_name,
      middle_initial: values.middle_initial,
      last_name: values.last_name,
      legal_name: values.legal_name,
      base_city: values.base_city,
      alternate_email: values.alternate_email,
      phone_number: values.phone_number,
      whatsapp: values.whatsapp,
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

/**
 * Composes a legal name string from the structured parts. Empty parts are
 * dropped so "Hermione Granger" works as well as "Hermione J. Granger".
 */
export function composeLegalName(parts: {
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
}): string {
  const middle = parts.middle_initial?.trim();
  const middleWithDot = middle ? (middle.endsWith('.') ? middle : `${middle}.`) : '';
  return [parts.first_name?.trim(), middleWithDot, parts.last_name?.trim()]
    .filter((s) => s && s.length > 0)
    .join(' ');
}
