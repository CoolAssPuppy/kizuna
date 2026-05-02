import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './agenda';

describe('agenda', () => {
  it('returns the active event sessions ordered by start time', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        sessions: [
          {
            id: 's-1',
            title: 'Welcome',
            starts_at: '2026-09-01T09:00:00.000Z',
            ends_at: '2026-09-01T10:00:00.000Z',
            location: null,
            is_mandatory: false,
            capacity: null,
          },
        ],
      },
    });
    const cmd = getCommand(['agenda'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      sessions: Array<{ id: string }>;
    };
    expect(out.sessions.map((s) => s.id)).toEqual(['s-1']);
  });
});
