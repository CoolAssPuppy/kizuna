import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx, createMockSupabase } from './_testHelpers';

import './attendees';

const ATTENDEE = (
  overrides: Partial<{
    user_id: string;
    email: string;
    team: string | null;
    hobbies: string[];
  }> = {},
) => ({
  user_id: overrides.user_id ?? 'u-1',
  hobbies: overrides.hobbies ?? ['snowboarding'],
  users: [
    {
      email: overrides.email ?? 'alice@example.com',
      employee_profiles: [
        {
          preferred_name: 'Alice',
          legal_name: 'Alice Anderson',
          team: overrides.team ?? 'Platform',
        },
      ],
      guest_profiles: [],
    },
  ],
});

describe('attendees', () => {
  it('flattens attendee + employee join', async () => {
    const supabase = createMockSupabase({
      tables: { attendee_profiles: [ATTENDEE()] },
    });
    const cmd = getCommand(['attendees'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      matches: Array<{ handle: string; fullName: string; team: string | null }>;
      total: number;
    };
    expect(out.total).toBe(1);
    expect(out.matches[0]).toMatchObject({ handle: 'alice', fullName: 'Alice', team: 'Platform' });
  });

  it('filters by handle when @user is provided', async () => {
    const supabase = createMockSupabase({
      tables: {
        attendee_profiles: [
          ATTENDEE({ user_id: 'u-1', email: 'alice@example.com' }),
          ATTENDEE({ user_id: 'u-2', email: 'bob@example.com', team: 'Design' }),
        ],
      },
    });
    const cmd = getCommand(['attendees'])!;
    const out = (await cmd.handler({ user: 'alice' }, createCtx({ supabase }))) as {
      matches: Array<{ handle: string }>;
    };
    expect(out.matches.map((m) => m.handle)).toEqual(['alice']);
  });

  it('filters by team', async () => {
    const supabase = createMockSupabase({
      tables: {
        attendee_profiles: [
          ATTENDEE({ user_id: 'u-1', email: 'alice@example.com', team: 'Platform' }),
          ATTENDEE({ user_id: 'u-2', email: 'bob@example.com', team: 'Design' }),
        ],
      },
    });
    const cmd = getCommand(['attendees'])!;
    const out = (await cmd.handler({ team: 'design' }, createCtx({ supabase }))) as {
      matches: Array<{ team: string | null }>;
    };
    expect(out.matches.map((m) => m.team)).toEqual(['Design']);
  });

  it('renders Markdown bullet list with team metadata', async () => {
    const supabase = createMockSupabase({
      tables: { attendee_profiles: [ATTENDEE()] },
    });
    const cmd = getCommand(['attendees'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    const md = cmd.toMarkdown!(out, createCtx());
    expect(md).toContain('@alice');
    expect(md).toContain('Platform');
  });

  it('renders empty Markdown when nothing matches', async () => {
    const supabase = createMockSupabase({ tables: { attendee_profiles: [] } });
    const cmd = getCommand(['attendees'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(cmd.toMarkdown!(out, createCtx())).toBe('_No attendees match._');
  });
});
