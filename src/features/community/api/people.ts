import type { AppSupabaseClient, Joined } from '@/lib/supabase';
import { flatJoin } from '@/lib/supabase';

import type { Profile } from '../matching';

interface AttendeeRow {
  user_id: string;
  hobbies: string[];
  hometown_city: string | null;
  hometown_country: string | null;
  current_city: string | null;
  current_country: string | null;
  user: Joined<{
    email: string;
    employee_profiles: Joined<{
      preferred_name: string | null;
      legal_name: string | null;
      avatar_url: string | null;
    }>;
    guest_profiles: Joined<{ first_name: string; last_name: string }>;
  }>;
}

function splitName(full: string | null | undefined): { first: string; last: string } {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return { first: '', last: '' };
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1) };
}

/**
 * Loads every attendee with a public-facing community profile, projected
 * into the shape the matching helpers expect. Visibility 'private' is
 * excluded so private-mode attendees don't surface in match lists.
 */
export async function loadCommunityPeople(client: AppSupabaseClient): Promise<Profile[]> {
  const { data, error } = await client
    .from('attendee_profiles')
    .select(
      `
      user_id, hobbies, hometown_city, hometown_country, current_city, current_country,
      user:users!attendee_profiles_user_id_fkey (
        email,
        employee_profiles ( preferred_name, legal_name, avatar_url ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .neq('visibility', 'private');
  if (error) throw error;

  const rows = (data ?? []) as unknown as AttendeeRow[];
  return rows.map((row) => {
    const user = flatJoin(row.user);
    const employee = flatJoin(user?.employee_profiles);
    const guest = flatJoin(user?.guest_profiles);
    let firstName = '';
    let lastName = '';
    if (guest?.first_name || guest?.last_name) {
      firstName = guest.first_name ?? '';
      lastName = guest.last_name ?? '';
    } else {
      const display = employee?.preferred_name ?? employee?.legal_name ?? user?.email ?? '';
      const split = splitName(display);
      firstName = split.first;
      lastName = split.last;
    }
    return {
      user_id: row.user_id,
      first_name: firstName,
      last_name: lastName,
      email: user?.email ?? '',
      avatar_url: employee?.avatar_url ?? null,
      hobbies: row.hobbies,
      hometown_city: row.hometown_city,
      hometown_country: row.hometown_country,
      current_city: row.current_city,
      current_country: row.current_country,
    } satisfies Profile;
  });
}
