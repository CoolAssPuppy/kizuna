import { resolveProfileName } from '@/lib/fullName';
import { flatJoin, type AppSupabaseClient, type Joined } from '@/lib/supabase';

import type { CsvRow } from './csv';
import type { NameProfile } from './shared';

export interface DietaryRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  restrictions: string;
  allergies: string;
  alcohol_free: boolean;
  severity: string;
  notes: string | null;
}

export async function fetchDietarySummary(client: AppSupabaseClient): Promise<DietaryRow[]> {
  const { data, error } = await client
    .from('dietary_preferences')
    .select(
      `
      restrictions, allergies, alcohol_free, severity, notes,
      users (
        email,
        employee_profiles ( first_name, last_name, preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .order('severity', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const user = flatJoin<{
      email: string;
      employee_profiles: Joined<NameProfile>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>(row.users);
    const { first, last } = resolveProfileName(
      flatJoin(user?.employee_profiles),
      flatJoin(user?.guest_profiles),
    );
    return {
      first_name: first,
      last_name: last,
      email: user?.email ?? '',
      restrictions: row.restrictions.join(', '),
      allergies: row.allergies.join(', '),
      alcohol_free: row.alcohol_free,
      severity: row.severity,
      notes: row.notes,
    };
  });
}
