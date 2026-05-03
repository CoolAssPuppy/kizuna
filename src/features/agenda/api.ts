import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { fetchTagsForSessions, setSessionTags, type SessionTag } from './tagsApi';

export type SessionRow = Database['public']['Tables']['sessions']['Row'];

export interface AgendaSession extends SessionRow {
  is_favorite: boolean;
  speaker_display_name: string | null;
  tags: SessionTag[];
}

// Excludes proposed sessions; those live on the Proposed tab via fetchProposals.
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
  const speakerEmails = Array.from(
    new Set(sessions.map((s) => s.speaker_email).filter((e): e is string => Boolean(e))),
  );

  const [speakerLookup, tagsBySession] = await Promise.all([
    fetchSpeakerDisplayNames(client, speakerEmails),
    fetchTagsForSessions(
      client,
      sessions.map((s) => s.id),
    ),
  ]);

  return sessions.map((s) => ({
    ...s,
    is_favorite: favoriteSet.has(s.id),
    speaker_display_name: s.speaker_email ? (speakerLookup.get(s.speaker_email) ?? null) : null,
    tags: tagsBySession.get(s.id) ?? [],
  }));
}

async function fetchSpeakerDisplayNames(
  client: AppSupabaseClient,
  emails: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  if (emails.length === 0) return lookup;
  const { data, error } = await client
    .from('users')
    .select('email, employee_profiles ( preferred_name, legal_name )')
    .in('email', emails);
  if (error) throw error;
  for (const u of data ?? []) {
    const name = u.employee_profiles?.preferred_name ?? u.employee_profiles?.legal_name ?? null;
    if (name) lookup.set(u.email, name);
  }
  return lookup;
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

export async function fetchProposals(
  client: AppSupabaseClient,
  args: { eventId: string; userId: string },
): Promise<ProposedSession[]> {
  return (await fetchAdminProposals(client, args)).map(({ voters: _voters, ...rest }) => rest);
}

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

  const [votesRes, tagsBySession] = await Promise.all([
    client.from('session_proposal_votes').select('session_id, user_id').in('session_id', ids),
    fetchTagsForSessions(client, ids),
  ]);
  if (votesRes.error) throw votesRes.error;
  const votes = votesRes.data ?? [];

  const referencedUserIds = new Set<string>();
  for (const s of list) {
    if (s.proposed_by) referencedUserIds.add(s.proposed_by);
  }
  for (const v of votes) referencedUserIds.add(v.user_id);
  const profiles = await fetchProposerProfiles(client, [...referencedUserIds]);

  const counts = new Map<string, number>();
  const userVotes = new Set<string>();
  const voters = new Map<string, ProposalVoter[]>();
  for (const v of votes) {
    counts.set(v.session_id, (counts.get(v.session_id) ?? 0) + 1);
    if (v.user_id === args.userId) userVotes.add(v.session_id);
    const bucket = voters.get(v.session_id) ?? [];
    bucket.push({ user_id: v.user_id, display_name: profiles.get(v.user_id) ?? v.user_id });
    voters.set(v.session_id, bucket);
  }

  return list.map((s) => ({
    ...s,
    proposer_display_name: s.proposed_by ? (profiles.get(s.proposed_by) ?? null) : null,
    vote_count: counts.get(s.id) ?? 0,
    has_voted: userVotes.has(s.id),
    tags: tagsBySession.get(s.id) ?? [],
    voters: voters.get(s.id) ?? [],
  }));
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

function proposalRowPayload(draft: ProposalDraft): {
  title: string;
  subtitle: string | null;
  type: ProposalDraft['type'];
  audience: ProposalDraft['audience'];
  abstract: string | null;
  speaker_email: string | null;
  is_mandatory: boolean;
} {
  return {
    title: draft.title,
    subtitle: draft.subtitle.trim() || null,
    type: draft.type,
    audience: draft.audience,
    abstract: draft.abstract.trim() || null,
    speaker_email: draft.speaker_email.trim().toLowerCase() || null,
    is_mandatory: draft.is_mandatory,
  };
}

export async function createProposal(
  client: AppSupabaseClient,
  args: { eventId: string; userId: string; draft: ProposalDraft },
): Promise<SessionRow> {
  const { data, error } = await client
    .from('sessions')
    .insert({
      ...proposalRowPayload(args.draft),
      event_id: args.eventId,
      status: 'proposed',
      proposed_by: args.userId,
    })
    .select()
    .single();
  if (error) throw error;
  await setSessionTags(client, { sessionId: data.id, tagIds: args.draft.tag_ids });
  return data;
}

// Wipes existing votes — surfaced as a warning in the propose dialog.
// The proposal must still be in `proposed` state; RLS denies otherwise.
export async function updateOwnProposal(
  client: AppSupabaseClient,
  args: { sessionId: string; draft: ProposalDraft },
): Promise<SessionRow> {
  const [voteRes, sessionRes] = await Promise.all([
    client.from('session_proposal_votes').delete().eq('session_id', args.sessionId),
    client
      .from('sessions')
      .update(proposalRowPayload(args.draft))
      .eq('id', args.sessionId)
      .select()
      .single(),
  ]);
  if (voteRes.error) throw voteRes.error;
  if (sessionRes.error) throw sessionRes.error;
  await setSessionTags(client, { sessionId: args.sessionId, tagIds: args.draft.tag_ids });
  return sessionRes.data;
}

export async function deleteOwnProposal(
  client: AppSupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await client.from('sessions').delete().eq('id', sessionId);
  if (error) throw error;
}
