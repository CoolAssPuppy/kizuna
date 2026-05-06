import { resolveProfileName } from '@/lib/fullName';
import { flatJoin, type AppSupabaseClient, type Joined } from '@/lib/supabase';

import type { CsvRow } from '../csv';
import type { NameProfile } from './shared';

export interface RegistrationProgressRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_leadership: boolean;
  completion_pct: number;
  status: string;
}

export async function fetchRegistrationProgress(
  client: AppSupabaseClient,
  eventId: string,
): Promise<RegistrationProgressRow[]> {
  const { data, error } = await client
    .from('registrations')
    .select(
      `
      completion_pct, status,
      user:users!registrations_user_id_fkey (
        email, role, is_leadership,
        employee_profiles ( first_name, last_name, preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .eq('event_id', eventId)
    .order('completion_pct', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const u = flatJoin<{
      email: string;
      role: string;
      is_leadership: boolean;
      employee_profiles: Joined<NameProfile>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>(row.user);
    const { first, last } = resolveProfileName(
      flatJoin(u?.employee_profiles),
      flatJoin(u?.guest_profiles),
    );
    return {
      first_name: first,
      last_name: last,
      email: u?.email ?? '',
      role: u?.role ?? '',
      is_leadership: u?.is_leadership ?? false,
      completion_pct: row.completion_pct,
      status: row.status,
    };
  });
}
