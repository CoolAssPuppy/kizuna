import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './sessions';

const ROW = {
  id: 's-1',
  title: 'Snowboarding workshop',
  starts_at: '2026-09-02T09:00:00.000Z',
  ends_at: '2026-09-02T10:30:00.000Z',
  location: 'Slope A',
  is_mandatory: false,
  capacity: 30,
  type: 'workshop',
};

describe('sessions', () => {
  it('returns the sessions for the active event', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], sessions: [ROW] },
    });
    const cmd = getCommand(['sessions'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      sessions: Array<{ id: string; title: string; mandatory: boolean }>;
    };
    expect(out.sessions).toHaveLength(1);
    expect(out.sessions[0]).toMatchObject({
      id: 's-1',
      title: 'Snowboarding workshop',
      mandatory: false,
    });
  });

  it('filters by track via post-query filter', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        sessions: [
          { ...ROW, type: 'workshop' },
          { ...ROW, id: 's-2', title: 'Keynote', type: 'keynote' },
        ],
      },
    });
    const cmd = getCommand(['sessions'])!;
    const out = (await cmd.handler({ track: 'keynote' }, createCtx({ supabase }))) as {
      sessions: Array<{ title: string }>;
    };
    expect(out.sessions.map((s) => s.title)).toEqual(['Keynote']);
  });

  it('renders empty Markdown when no sessions match', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], sessions: [] },
    });
    const cmd = getCommand(['sessions'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(cmd.toMarkdown!(out, createCtx())).toBe('_No sessions match._');
  });
});
