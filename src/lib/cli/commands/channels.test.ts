import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx, createMockSupabase } from './_testHelpers';

import './channels';

describe('channels', () => {
  it('returns active channels', async () => {
    const supabase = createMockSupabase({
      tables: {
        channels: [
          { slug: 'general', name: 'General', description: 'Everyone' },
          { slug: 'food', name: 'Food', description: null },
        ],
      },
    });
    const cmd = getCommand(['channels'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      channels: Array<{ slug: string }>;
    };
    expect(out.channels.map((c) => c.slug)).toEqual(['general', 'food']);
  });

  it('renders empty Markdown when no channels exist', async () => {
    const supabase = createMockSupabase({ tables: { channels: [] } });
    const cmd = getCommand(['channels'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(cmd.toMarkdown!(out, createCtx())).toBe('_No channels._');
  });
});
