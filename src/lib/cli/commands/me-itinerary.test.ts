import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './me-itinerary';

const ITEM = {
  id: 'i-1',
  item_type: 'session',
  title: 'Opening keynote',
  starts_at: '2026-09-01T09:00:00.000Z',
  ends_at: '2026-09-01T10:00:00.000Z',
  subtitle: 'Main hall',
  source: 'sessions',
  source_id: 's-1',
};

describe('me itinerary', () => {
  it('returns itinerary items shaped to the public schema', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        itinerary_items: [ITEM],
      },
    });
    const cmd = getCommand(['me', 'itinerary'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      eventId: string;
      items: Array<{ id: string; title: string; location: string | null }>;
    };
    expect(out.eventId).toBe(ACTIVE_EVENT_ROW.id);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({
      id: 'i-1',
      title: 'Opening keynote',
      location: 'Main hall',
    });
  });

  it('emits "no items" Markdown when empty', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], itinerary_items: [] },
    });
    const cmd = getCommand(['me', 'itinerary'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    const md = cmd.toMarkdown!(out, createCtx());
    expect(md).toBe('_No itinerary items yet._');
  });

  it('renders the title and location in Markdown when items exist', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], itinerary_items: [ITEM] },
    });
    const cmd = getCommand(['me', 'itinerary'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    const md = cmd.toMarkdown!(out, createCtx());
    expect(md).toContain('Opening keynote');
    expect(md).toContain('_(Main hall)_');
  });

  it('throws a translated error when no active event exists', async () => {
    const supabase = createMockSupabase({ tables: { events: [] } });
    const cmd = getCommand(['me', 'itinerary'])!;
    await expect(cmd.handler({}, createCtx({ supabase }))).rejects.toThrow(
      'cli.errors.noActiveEvent',
    );
  });
});
