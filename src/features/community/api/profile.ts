import type { AppSupabaseClient } from '@/lib/supabase';

export interface CommunityProfileRow {
  user_id: string;
  bio: string | null;
  hobbies: string[];
  fun_fact: string | null;
  hometown_city: string | null;
  hometown_country: string | null;
  current_city: string | null;
  current_country: string | null;
}

const COLUMNS =
  'user_id, bio, hobbies, fun_fact, hometown_city, hometown_country, current_city, current_country';

export async function loadCommunityProfile(
  client: AppSupabaseClient,
  userId: string,
): Promise<CommunityProfileRow> {
  const { data, error } = await client
    .from('attendee_profiles')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (
    data ?? {
      user_id: userId,
      bio: null,
      hobbies: [],
      fun_fact: null,
      hometown_city: null,
      hometown_country: null,
      current_city: null,
      current_country: null,
    }
  );
}

export async function saveCommunityProfile(
  client: AppSupabaseClient,
  userId: string,
  profile: Omit<CommunityProfileRow, 'user_id'>,
): Promise<void> {
  const { error } = await client
    .from('attendee_profiles')
    .upsert({ user_id: userId, ...profile }, { onConflict: 'user_id' });
  if (error) throw error;
}

export interface HobbyOption {
  slug: string;
  label: string;
  category: string;
}

export async function loadHobbyCatalog(client: AppSupabaseClient): Promise<HobbyOption[]> {
  const { data, error } = await client
    .from('hobby_catalog')
    .select('slug, label, category')
    .order('label', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
