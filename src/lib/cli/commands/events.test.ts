import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './events';

describe('events', () => {
  it('lists every visible event', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [
          ACTIVE_EVENT_ROW,
          {
            id: 'event-2',
            name: 'Past',
            start_date: '2024-01-01',
            end_date: '2024-01-05',
            location: null,
            is_active: false,
            type: 'supafest',
          },
        ],
      },
    });
    const cmd = getCommand(['events'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      events: Array<{ id: string }>;
    };
    expect(out.events.map((e) => e.id)).toEqual(['event-1', 'event-2']);
  });
});

describe('event', () => {
  it('returns the active event by default', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW] },
    });
    const cmd = getCommand(['event'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(out).toMatchObject({ id: 'event-1', active: true });
  });

  it('looks up by id when an :id ref is provided', async () => {
    const target = { ...ACTIVE_EVENT_ROW, id: 'other', name: 'Other event', is_active: false };
    const supabase = createMockSupabase({
      tables: { events: [target] },
    });
    const cmd = getCommand(['event'])!;
    const out = await cmd.handler({ id: 'other' }, createCtx({ supabase }));
    expect(out).toMatchObject({ id: 'other', name: 'Other event', active: false });
  });
});
