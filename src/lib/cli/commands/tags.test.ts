import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './tags';

const TAG_ROWS = [
  { id: 't-1', name: 'Engineering', color: '#3ecf8e', position: 0 },
  { id: 't-2', name: 'People', color: '#f97316', position: 1 },
];

describe('tags list', () => {
  it('returns tags ordered by position', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], session_tags: TAG_ROWS },
    });
    const cmd = getCommand(['tags', 'list'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      tags: Array<{ id: string; name: string }>;
    };
    expect(out.tags.map((t) => t.name)).toEqual(['Engineering', 'People']);
  });

  it('renders empty Markdown when no tags exist', async () => {
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], session_tags: [] },
    });
    const cmd = getCommand(['tags', 'list'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(cmd.toMarkdown!(out, createCtx())).toBe('_No tags yet._');
  });
});

describe('tags create', () => {
  it('rejects an invalid hex color via the input schema', () => {
    const cmd = getCommand(['tags', 'create'])!;
    const result = cmd.input.safeParse({ name: 'Networking', color: 'red' });
    expect(result.success).toBe(false);
  });

  it('inserts a tag scoped to the active event', async () => {
    const inserted = { id: 't-new', name: 'Networking', color: '#22d3ee', position: 2 };
    const supabase = createMockSupabase({
      tables: { events: [ACTIVE_EVENT_ROW], session_tags: [inserted] },
    });
    const cmd = getCommand(['tags', 'create'])!;
    const out = (await cmd.handler(
      { name: 'Networking', color: '#22d3ee', position: 2 },
      createCtx({ supabase, role: 'admin' }),
    )) as { id: string; name: string; color: string };
    expect(out).toMatchObject({ name: 'Networking', color: '#22d3ee' });
  });
});

describe('tags update', () => {
  it('requires at least one of --name, --color, or --position', () => {
    const cmd = getCommand(['tags', 'update'])!;
    const result = cmd.input.safeParse({ id: 't-1' });
    expect(result.success).toBe(false);
  });

  it('returns the updated row on a name change', async () => {
    const supabase = createMockSupabase({
      tables: { session_tags: [{ id: 't-1', name: 'Speakers', color: '#3ecf8e', position: 0 }] },
    });
    const cmd = getCommand(['tags', 'update'])!;
    const out = (await cmd.handler(
      { id: 't-1', name: 'Speakers' },
      createCtx({ supabase, role: 'admin' }),
    )) as { name: string };
    expect(out.name).toBe('Speakers');
  });

  it('errors when no id is provided', async () => {
    const supabase = createMockSupabase({});
    const cmd = getCommand(['tags', 'update'])!;
    await expect(
      cmd.handler({ name: 'Renamed' }, createCtx({ supabase, role: 'admin' })),
    ).rejects.toThrow();
  });
});

describe('tags delete', () => {
  it('requires an id', async () => {
    const supabase = createMockSupabase({});
    const cmd = getCommand(['tags', 'delete'])!;
    await expect(cmd.handler({}, createCtx({ supabase, role: 'admin' }))).rejects.toThrow();
  });

  it('returns the deleted id on success', async () => {
    const supabase = createMockSupabase({
      tables: { session_tags: [] },
    });
    const cmd = getCommand(['tags', 'delete'])!;
    const out = (await cmd.handler({ id: 't-1' }, createCtx({ supabase, role: 'admin' }))) as {
      id: string;
      deleted: boolean;
    };
    expect(out).toEqual({ id: 't-1', deleted: true });
  });
});
