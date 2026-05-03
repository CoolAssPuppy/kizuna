import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { fetchTagsForSessions, type SessionTag } from './tagsApi';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];

export interface AgendaSession extends SessionRow {
  is_favorite: boolean;
  speaker_display_name: string | null;
  tags: SessionTag[];
}

/**
 * Loads every active session for the event plus the current user's
 * favorites, and joins back to public.users to surface the speaker's
 * display name when the speaker_email matches an internal account.
 * Proposed sessions are intentionally excluded — they live on the
 * Proposed tab via fetchProposals().
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
      .eq('status', 'active')
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

  const tagsBySession = await fetchTagsForSessions(
    client,
    sessions.map((s) => s.id),
  );

  return sessions.map((s) => ({
    ...s,
    is_favorite: favoriteSet.has(s.id),
    speaker_display_name: s.speaker_email ? (speakerLookup.get(s.speaker_email) ?? null) : null,
    tags: tagsBySession.get(s.id) ?? [],
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

export interface ProposedSession extends SessionRow {
  proposer_display_name: string | null;
  vote_count: number;
  has_voted: boolean;
  tags: SessionTag[];
}

/**
 * Loads every proposed session for the event, plus the proposer's
 * display name and aggregate vote counts. has_voted is set per-row for
 * the calling user so the UI can disable the vote button.
 */
export async function fetchProposals(
  client: AppSupabaseClient,
  args: { eventId: string; userId: string },
): Promise<ProposedSession[]> {
  const { data: sessions, error } = await client
    .from('sessions')
    .select('*')
    .eq('event_id', args.eventId)
    .eq('status', 'proposed')
    .order('id', { ascending: true });
  if (error) throw error;

  const list = sessions ?? [];
  if (list.length === 0) return [];
  const ids = list.map((s) => s.id);

  const [votesRes, profilesRes, tagsBySession] = await Promise.all([
    client.from('session_proposal_votes').select('session_id, user_id').in('session_id', ids),
    fetchProposerProfiles(
      client,
      list.map((s) => s.proposed_by).filter((v): v is string => Boolean(v)),
    ),
    fetchTagsForSessions(client, ids),
  ]);
  if (votesRes.error) throw votesRes.error;

  const counts = new Map<string, number>();
  const userVotes = new Set<string>();
  for (const v of votesRes.data ?? []) {
    counts.set(v.session_id, (counts.get(v.session_id) ?? 0) + 1);
    if (v.user_id === args.userId) userVotes.add(v.session_id);
  }

  return list.map((s) => ({
    ...s,
    proposer_display_name: s.proposed_by ? (profilesRes.get(s.proposed_by) ?? null) : null,
    vote_count: counts.get(s.id) ?? 0,
    has_voted: userVotes.has(s.id),
    tags: tagsBySession.get(s.id) ?? [],
  }));
}

/**
 * Admin-only variant: also returns the list of voter rows (user_id +
 * display name) per proposed session, for the admin proposals view.
 */
export interface ProposalVoter {
  user_id: string;
  display_name: string;
}

export interface AdminProposedSession extends ProposedSession {
  voters: ProposalVoter[];
}

export async function fetchAdminProposals(
  client: AppSupabaseClient,
  args: { eventId: string; userId: string },
): Promise<AdminProposedSession[]> {
  const proposals = await fetchProposals(client, args);
  if (proposals.length === 0) return [];

  const ids = proposals.map((p) => p.id);
  const { data: votes, error } = await client
    .from('session_proposal_votes')
    .select('session_id, user_id')
    .in('session_id', ids);
  if (error) throw error;

  const voterIds = Array.from(new Set((votes ?? []).map((v) => v.user_id)));
  const voterProfiles = await fetchProposerProfiles(client, voterIds);

  const grouped = new Map<string, ProposalVoter[]>();
  for (const row of votes ?? []) {
    const list = grouped.get(row.session_id) ?? [];
    list.push({
      user_id: row.user_id,
      display_name: voterProfiles.get(row.user_id) ?? row.user_id,
    });
    grouped.set(row.session_id, list);
  }

  return proposals.map((p) => ({ ...p, voters: grouped.get(p.id) ?? [] }));
}

async function fetchProposerProfiles(
  client: AppSupabaseClient,
  userIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  if (userIds.length === 0) return lookup;
  const { data, error } = await client
    .from('users')
    .select('id, email, employee_profiles ( preferred_name, legal_name )')
    .in('id', userIds);
  if (error) throw error;
  for (const u of data ?? []) {
    const profile = u.employee_profiles;
    const name = profile?.preferred_name ?? profile?.legal_name ?? u.email;
    lookup.set(u.id, name);
  }
  return lookup;
}

export async function voteForProposal(
  client: AppSupabaseClient,
  args: { sessionId: string; userId: string },
): Promise<void> {
  const { error } = await client
    .from('session_proposal_votes')
    .insert({ session_id: args.sessionId, user_id: args.userId });
  if (error && error.code !== '23505') throw error;
}

export interface ProposalDraft {
  title: string;
  subtitle: string;
  type: Database['public']['Enums']['session_type'];
  audience: Database['public']['Enums']['session_audience'];
  abstract: string;
  speaker_email: string;
  is_mandatory: boolean;
  tag_ids: ReadonlyArray<string>;
}

export async function createProposal(
  client: AppSupabaseClient,
  args: { eventId: string; userId: string; draft: ProposalDraft },
): Promise<SessionRow> {
  const { draft } = args;
  const { data, error } = await client
    .from('sessions')
    .insert({
      event_id: args.eventId,
      title: draft.title,
      subtitle: draft.subtitle.trim() || null,
      type: draft.type,
      audience: draft.audience,
      status: 'proposed',
      proposed_by: args.userId,
      abstract: draft.abstract.trim() || null,
      speaker_email: draft.speaker_email.trim().toLowerCase() || null,
      is_mandatory: draft.is_mandatory,
    })
    .select()
    .single();
  if (error) throw error;

  if (draft.tag_ids.length > 0) {
    const { error: tagsError } = await client
      .from('session_tag_assignments')
      .insert(draft.tag_ids.map((tag_id) => ({ session_id: data.id, tag_id })));
    if (tagsError) throw tagsError;
  }
  return data;
}

/**
 * Proposer-driven update of an existing proposal. Wipes existing votes
 * — see the warning surfaced in the propose dialog. The proposal must
 * still be in `proposed` state for RLS to allow the update.
 */
export async function updateOwnProposal(
  client: AppSupabaseClient,
  args: { sessionId: string; draft: ProposalDraft },
): Promise<SessionRow> {
  const { draft } = args;
  // Vote-wipe runs first so a session that fails to update doesn't
  // lose its votes silently.
  const { error: voteErr } = await client
    .from('session_proposal_votes')
    .delete()
    .eq('session_id', args.sessionId);
  if (voteErr) throw voteErr;

  const { data, error } = await client
    .from('sessions')
    .update({
      title: draft.title,
      subtitle: draft.subtitle.trim() || null,
      type: draft.type,
      audience: draft.audience,
      abstract: draft.abstract.trim() || null,
      speaker_email: draft.speaker_email.trim().toLowerCase() || null,
      is_mandatory: draft.is_mandatory,
    })
    .eq('id', args.sessionId)
    .select()
    .single();
  if (error) throw error;

  // Replace tag assignments. Proposer policies allow insert and delete
  // on session_tag_assignments scoped to a proposal they own.
  const { data: current, error: readErr } = await client
    .from('session_tag_assignments')
    .select('tag_id')
    .eq('session_id', args.sessionId);
  if (readErr) throw readErr;
  const currentIds = new Set((current ?? []).map((r) => r.tag_id));
  const desiredIds = new Set(draft.tag_ids);
  const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));
  if (toAdd.length > 0) {
    const { error: addErr } = await client
      .from('session_tag_assignments')
      .insert(toAdd.map((tag_id) => ({ session_id: args.sessionId, tag_id })));
    if (addErr) throw addErr;
  }
  if (toRemove.length > 0) {
    const { error: rmErr } = await client
      .from('session_tag_assignments')
      .delete()
      .eq('session_id', args.sessionId)
      .in('tag_id', toRemove);
    if (rmErr) throw rmErr;
  }
  return data;
}

export async function deleteOwnProposal(
  client: AppSupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await client.from('sessions').delete().eq('id', sessionId);
  if (error) throw error;
}
