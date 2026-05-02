import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx, createMockSupabase } from './_testHelpers';

import './me-notifications';

describe('me notifications', () => {
  it('returns notifications shaped to the public schema', async () => {
    const supabase = createMockSupabase({
      tables: {
        notifications: [
          {
            id: 'n-1',
            subject: 'Passport reminder',
            sent_at: '2026-08-01T09:00:00.000Z',
            read_at: null,
          },
        ],
      },
    });
    const cmd = getCommand(['me', 'notifications'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      notifications: Array<{ id: string; read: boolean }>;
    };
    expect(out.notifications).toEqual([
      { id: 'n-1', subject: 'Passport reminder', sentAt: '2026-08-01T09:00:00.000Z', read: false },
    ]);
  });
});
