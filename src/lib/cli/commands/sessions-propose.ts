// Session proposal commands. Mirrors the in-app propose / list / vote /
// edit / delete flow. RLS gates each mutation: anyone authenticated can
// propose for themselves, vote once, and edit/delete their own proposal
// while it remains in 'proposed' state.

import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag, IdRef } from './_schemas.ts';
import { getActiveEvent } from './_shared.ts';

const SessionType = z.enum([
  'keynote',
  'breakout',
  'workshop',
  'dinner',
  'activity',
  'transport',
  'social',
]);

const SessionAudience = z.enum(['all', 'employees_only', 'guests_only', 'opt_in']);

export const ProposalItem = z.object({
  id: z.string(),
  title: z.string(),
  abstract: z.string().nullable(),
  proposedBy: z.string().nullable(),
  proposerEmail: z.string().nullable(),
  voteCount: z.number(),
  hasVoted: z.boolean(),
  tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
  isOwn: z.boolean(),
});

const ProposalsListInput = z.object({ format: FormatFlag, args: Args }).strict();
const ProposalsListOutput = z.object({ proposals: z.array(ProposalItem) });

interface AssignmentRow {
  session_id: string;
  session_tags: { id: string; name: string; color: string } | null;
}

interface ProposalRow {
  id: string;
  title: string;
  abstract: string | null;
  proposed_by: string | null;
  users: { email: string } | null;
}

registerCommand({
  path: ['sessions', 'propose', 'list'],
  summaryKey: 'cli.commands.sessionsProposeList.summary',
  descriptionKey: 'cli.commands.sessionsProposeList.description',
  examples: ['sessions propose list', 'sessions propose list --format md'],
  scope: 'user',
  input: ProposalsListInput,
  output: ProposalsListOutput,
  handler: async (_input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data, error } = await ctx.supabase
      .from('sessions')
      .select('id, title, abstract, proposed_by, users:proposed_by(email)')
      .eq('event_id', event.id)
      .eq('status', 'proposed')
      .order('id', { ascending: true });
    if (error) throw error;
    const proposals = (data ?? []) as unknown as ProposalRow[];
    if (proposals.length === 0) return { proposals: [] };

    const ids = proposals.map((p) => p.id);
    const [votesRes, assignmentsRes] = await Promise.all([
      ctx.supabase
        .from('session_proposal_votes')
        .select('session_id, user_id')
        .in('session_id', ids),
      ctx.supabase
        .from('session_tag_assignments')
        .select('session_id, session_tags(id, name, color)')
        .in('session_id', ids),
    ]);
    if (votesRes.error) throw votesRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const votes = votesRes.data ?? [];
    const assignments = (assignmentsRes.data ?? []) as unknown as AssignmentRow[];

    const counts = new Map<string, number>();
    const ownVotes = new Set<string>();
    for (const v of votes) {
      counts.set(v.session_id, (counts.get(v.session_id) ?? 0) + 1);
      if (v.user_id === ctx.user.id) ownVotes.add(v.session_id);
    }

    const tagsBySession = new Map<string, { id: string; name: string; color: string }[]>();
    for (const a of assignments) {
      if (!a.session_tags) continue;
      const list = tagsBySession.get(a.session_id) ?? [];
      list.push(a.session_tags);
      tagsBySession.set(a.session_id, list);
    }

    return {
      proposals: proposals.map((p) => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        proposedBy: p.proposed_by,
        proposerEmail: p.users?.email ?? null,
        voteCount: counts.get(p.id) ?? 0,
        hasVoted: ownVotes.has(p.id),
        tags: tagsBySession.get(p.id) ?? [],
        isOwn: p.proposed_by === ctx.user.id,
      })),
    };
  },
  toMarkdown: (output) =>
    output.proposals.length === 0
      ? '_No proposals yet._'
      : output.proposals
          .map(
            (p) =>
              `- **${p.title}** — ${p.voteCount} ${p.voteCount === 1 ? 'vote' : 'votes'}` +
              (p.proposerEmail ? ` _(${p.proposerEmail})_` : '') +
              (p.hasVoted ? ' ✓' : '') +
              (p.isOwn ? ' (yours)' : '') +
              (p.abstract ? `\n  ${p.abstract}` : ''),
          )
          .join('\n'),
});

const ProposeInput = z
  .object({
    format: FormatFlag,
    args: Args,
    title: z.string().min(1),
    abstract: z.string().optional(),
    type: SessionType.default('breakout'),
    audience: SessionAudience.default('all'),
    speaker: z.string().email().optional(),
    mandatory: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
  })
  .strict();

const ProposeOutput = z.object({
  id: z.string(),
  title: z.string(),
});

registerCommand({
  path: ['sessions', 'propose'],
  summaryKey: 'cli.commands.sessionsPropose.summary',
  descriptionKey: 'cli.commands.sessionsPropose.description',
  examples: [
    'sessions propose --title "Postgres MVCC deep dive" --abstract "How vacuum really works"',
    'sessions propose --title "Cooking with kim" --tags Engineering,People',
  ],
  scope: 'user',
  mutation: true,
  input: ProposeInput,
  output: ProposeOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data, error } = await ctx.supabase
      .from('sessions')
      .insert({
        event_id: event.id,
        title: input.title,
        abstract: input.abstract ?? null,
        type: input.type,
        audience: input.audience,
        status: 'proposed',
        proposed_by: ctx.user.id,
        speaker_email: input.speaker?.toLowerCase() ?? null,
        is_mandatory: input.mandatory,
      })
      .select('id, title')
      .single();
    if (error) throw error;

    if (input.tags && input.tags.length > 0) {
      const { data: tagRows, error: tagsErr } = await ctx.supabase
        .from('session_tags')
        .select('id, name')
        .eq('event_id', event.id);
      if (tagsErr) throw tagsErr;
      const wanted = new Set(input.tags.map((name) => name.toLowerCase()));
      const matched = (tagRows ?? []).filter((tag) => wanted.has(tag.name.toLowerCase()));
      if (matched.length > 0) {
        const { error: assignErr } = await ctx.supabase
          .from('session_tag_assignments')
          .insert(matched.map((tag) => ({ session_id: data.id, tag_id: tag.id })));
        if (assignErr) throw assignErr;
      }
    }

    return { id: data.id, title: data.title };
  },
  toMarkdown: (output) => `Proposed **${output.title}** (id: ${output.id}).`,
});

const VoteInput = z
  .object({
    format: FormatFlag,
    args: Args,
    id: IdRef,
  })
  .strict();

const VoteOutput = z.object({ id: z.string(), voted: z.literal(true) });

registerCommand({
  path: ['sessions', 'propose', 'vote'],
  summaryKey: 'cli.commands.sessionsProposeVote.summary',
  descriptionKey: 'cli.commands.sessionsProposeVote.description',
  examples: ['sessions propose vote :sessionId'],
  scope: 'user',
  mutation: true,
  input: VoteInput,
  output: VoteOutput,
  handler: async (input, ctx) => {
    const sessionId = input.id ?? input.args?.[0];
    if (!sessionId) throw new Error(ctx.t('cli.errors.idRequired'));
    const { error } = await ctx.supabase
      .from('session_proposal_votes')
      .insert({ session_id: sessionId, user_id: ctx.user.id });
    // 23505 = unique violation; user has already voted. Treat as a
    // no-op so the command stays idempotent.
    if (error && error.code !== '23505') throw error;
    return { id: sessionId, voted: true };
  },
  toMarkdown: (output) => `Vote recorded for ${output.id}.`,
});

const DeleteInput = z
  .object({
    format: FormatFlag,
    args: Args,
    id: IdRef,
  })
  .strict();

const DeleteOutput = z.object({ id: z.string(), deleted: z.literal(true) });

registerCommand({
  path: ['sessions', 'propose', 'delete'],
  summaryKey: 'cli.commands.sessionsProposeDelete.summary',
  descriptionKey: 'cli.commands.sessionsProposeDelete.description',
  examples: ['sessions propose delete :sessionId'],
  scope: 'user',
  mutation: true,
  input: DeleteInput,
  output: DeleteOutput,
  handler: async (input, ctx) => {
    const sessionId = input.id ?? input.args?.[0];
    if (!sessionId) throw new Error(ctx.t('cli.errors.idRequired'));
    const { error } = await ctx.supabase.from('sessions').delete().eq('id', sessionId);
    if (error) throw error;
    return { id: sessionId, deleted: true };
  },
  toMarkdown: (output) => `Deleted proposal ${output.id}.`,
});
