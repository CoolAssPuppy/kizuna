import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './sessions-propose';

const PROPOSAL_ROW = {
  id: 's-prop-1',
  title: 'Postgres MVCC deep dive',
  abstract: 'How vacuum really works',
  proposed_by: 'u-1',
  users: { email: 'me@example.com' },
};

const OTHER_PROPOSAL_ROW = {
  id: 's-prop-2',
  title: 'Cooking with kim',
  abstract: null,
  proposed_by: 'u-2',
  users: { email: 'kim@example.com' },
};

describe('sessions propose list', () => {
  it('returns proposals with vote counts and own-flag', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        sessions: [PROPOSAL_ROW, OTHER_PROPOSAL_ROW],
        session_proposal_votes: [
          { session_id: 's-prop-1', user_id: 'u-1' },
          { session_id: 's-prop-1', user_id: 'u-3' },
          { session_id: 's-prop-2', user_id: 'u-1' },
        ],
        session_tag_assignments: [],
      },
    });
    const cmd = getCommand(['sessions', 'propose', 'list'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      proposals: Array<{
        id: string;
        title: string;
        voteCount: number;
        hasVoted: boolean;
        isOwn: boolean;
      }>;
    };
    expect(out.proposals).toHaveLength(2);
    const mine = out.proposals.find((p) => p.id === 's-prop-1')!;
    expect(mine.voteCount).toBe(2);
    expect(mine.hasVoted).toBe(true);
    expect(mine.isOwn).toBe(true);
    const theirs = out.proposals.find((p) => p.id === 's-prop-2')!;
    expect(theirs.isOwn).toBe(false);
  });

  it('renders empty markdown when no proposals exist', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        sessions: [],
        session_proposal_votes: [],
        session_tag_assignments: [],
      },
    });
    const cmd = getCommand(['sessions', 'propose', 'list'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(cmd.toMarkdown!(out, createCtx())).toBe('_No proposals yet._');
  });
});

describe('sessions propose', () => {
  it('rejects an empty title via the input schema', () => {
    const cmd = getCommand(['sessions', 'propose'])!;
    const result = cmd.input.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('inserts a proposal scoped to the active event and the caller', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        sessions: [{ id: 's-new', title: 'My idea' }],
        session_tags: [],
      },
    });
    const cmd = getCommand(['sessions', 'propose'])!;
    const out = (await cmd.handler(
      { title: 'My idea', type: 'breakout', audience: 'all', mandatory: false },
      createCtx({ supabase }),
    )) as { id: string; title: string };
    expect(out).toEqual({ id: 's-new', title: 'My idea' });
  });
});

describe('sessions propose vote', () => {
  it('requires a session id', async () => {
    const supabase = createMockSupabase({});
    const cmd = getCommand(['sessions', 'propose', 'vote'])!;
    await expect(cmd.handler({}, createCtx({ supabase }))).rejects.toThrow();
  });

  it('treats a duplicate-vote unique violation as a no-op success', async () => {
    const supabase = createMockSupabase({
      tables: { session_proposal_votes: [] },
      errors: { session_proposal_votes: '23505' },
    });
    // Inject the Postgres code by tweaking the mock to return a typed error.
    const cmd = getCommand(['sessions', 'propose', 'vote'])!;
    // The mock returns a string-only error; simulate the duplicate path
    // using a custom wrapper.
    const real = supabase.from('session_proposal_votes');
    void real;
    // Use a dedicated mock that returns the right error code shape.
    const ctxSupabase = createMockSupabase({
      tables: { session_proposal_votes: [] },
    }) as unknown as {
      from: (table: string) => unknown;
      rpc: unknown;
      auth: unknown;
    };
    const originalFrom = ctxSupabase.from;
    ctxSupabase.from = (table: string) => {
      const builder = originalFrom.call(ctxSupabase, table);
      // Override `then` so the resolved value carries error.code = '23505'.
      (builder as { then: unknown }).then = (
        onFulfilled: (value: unknown) => unknown,
      ): Promise<unknown> =>
        Promise.resolve(
          onFulfilled({ data: null, error: { code: '23505', message: 'duplicate' } }),
        );
      return builder;
    };
    const out = (await cmd.handler(
      { id: 's-prop-1' },
      createCtx({ supabase: ctxSupabase as never }),
    )) as { id: string; voted: boolean };
    expect(out).toEqual({ id: 's-prop-1', voted: true });
  });
});

describe('sessions propose delete', () => {
  it('requires a session id', async () => {
    const supabase = createMockSupabase({});
    const cmd = getCommand(['sessions', 'propose', 'delete'])!;
    await expect(cmd.handler({}, createCtx({ supabase }))).rejects.toThrow();
  });

  it('returns the deleted id on success', async () => {
    const supabase = createMockSupabase({
      tables: { sessions: [] },
    });
    const cmd = getCommand(['sessions', 'propose', 'delete'])!;
    const out = (await cmd.handler({ id: 's-prop-1' }, createCtx({ supabase }))) as {
      id: string;
      deleted: boolean;
    };
    expect(out).toEqual({ id: 's-prop-1', deleted: true });
  });
});
