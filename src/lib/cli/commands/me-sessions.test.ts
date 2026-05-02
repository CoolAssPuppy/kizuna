import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './me-sessions';

describe('me sessions', () => {
  it('returns empty when the user has no registrations', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], session_registrations: [] },
    });
    const cmd = getCommand(['me', 'sessions'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as { sessions: unknown[] };
    expect(out.sessions).toEqual([]);
  });

  it('joins registrations to sessions table when registrations exist', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        session_registrations: [{ session_id: 's-1' }],
        sessions: [
          {
            id: 's-1',
            title: 'Keynote',
            starts_at: '2026-09-01T09:00:00.000Z',
            ends_at: '2026-09-01T10:00:00.000Z',
            location: 'Main hall',
            is_mandatory: true,
            capacity: 200,
          },
        ],
      },
    });
    const cmd = getCommand(['me', 'sessions'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      sessions: Array<{ id: string; mandatory: boolean }>;
    };
    expect(out.sessions).toEqual([expect.objectContaining({ id: 's-1', mandatory: true })]);
  });

  it('reads the favorites table when --favorited is set', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        session_favorites: [{ session_id: 's-2' }],
        sessions: [
          {
            id: 's-2',
            title: 'Snowshoe walk',
            starts_at: '2026-09-02T09:00:00.000Z',
            ends_at: '2026-09-02T10:00:00.000Z',
            location: 'Trailhead',
            is_mandatory: false,
            capacity: 50,
          },
        ],
      },
    });
    const cmd = getCommand(['me', 'sessions'])!;
    const out = (await cmd.handler({ favorited: true }, createCtx({ supabase }))) as {
      sessions: Array<{ title: string }>;
    };
    expect(out.sessions[0]?.title).toBe('Snowshoe walk');
  });
});
