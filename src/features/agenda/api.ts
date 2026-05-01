import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];

export interface AgendaSession extends SessionRow {
  is_favorite: boolean;
  speaker_display_name: string | null;
}

/**
 * Loads every session for the event plus the current user's favorites,
 * and joins back to public.users to surface the speaker's display name
 * when the speaker_email matches an internal account.
 */
export async function fetchAgenda(
  client: AppSupabaseClient,
  args: { eventId: string; userId: string },
): Promise<AgendaSession[]> {
  const [sessionsRes, favoritesRes] = await Promise.all([
    client
      .from('sessions')
      .select('*')
      .eq('event_id', args.eventId)
      .order('starts_at', { ascending: true }),
    client.from('session_favorites').select('session_id').eq('user_id', args.userId),
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (favoritesRes.error) throw favoritesRes.error;

  const favoriteSet = new Set((favoritesRes.data ?? []).map((r) => r.session_id));
  const sessions = sessionsRes.data ?? [];

  // Resolve speaker emails to display names in a single round-trip.
  const speakerEmails = Array.from(
    new Set(sessions.map((s) => s.speaker_email).filter((e): e is string => Boolean(e))),
  );
  const speakerLookup = new Map<string, string>();
  if (speakerEmails.length > 0) {
    const { data: users } = await client
      .from('users')
      .select('email, employee_profiles ( preferred_name, legal_name )')
      .in('email', speakerEmails);
    for (const u of users ?? []) {
      const profile = u.employee_profiles;
      const name = profile?.preferred_name ?? profile?.legal_name ?? null;
      if (name) speakerLookup.set(u.email, name);
    }
  }

  return sessions.map((s) => ({
    ...s,
    is_favorite: favoriteSet.has(s.id),
    speaker_display_name: s.speaker_email ? (speakerLookup.get(s.speaker_email) ?? null) : null,
  }));
}

export async function favoriteSession(
  client: AppSupabaseClient,
  args: { sessionId: string; userId: string },
): Promise<void> {
  const { error } = await client
    .from('session_favorites')
    .insert({ session_id: args.sessionId, user_id: args.userId });
  if (error && error.code !== '23505') throw error; // ignore unique-violation (already favorited)
}

export async function unfavoriteSession(
  client: AppSupabaseClient,
  args: { sessionId: string; userId: string },
): Promise<void> {
  const { error } = await client
    .from('session_favorites')
    .delete()
    .eq('session_id', args.sessionId)
    .eq('user_id', args.userId);
  if (error) throw error;
}
