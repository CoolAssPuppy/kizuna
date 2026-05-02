import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './photos';

describe('photos', () => {
  it('marks photos uploaded by the caller as mine', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        event_photos: [
          {
            id: 'p-1',
            caption: 'Snow',
            uploader_id: 'u-1',
            created_at: '2026-09-01T10:00:00.000Z',
          },
          {
            id: 'p-2',
            caption: '#launch',
            uploader_id: 'u-2',
            created_at: '2026-09-01T11:00:00.000Z',
          },
        ],
      },
    });
    const cmd = getCommand(['photos'])!;
    const out = (await cmd.handler(
      {},
      createCtx({ supabase, user: { id: 'u-1', email: 'me@example.com', role: 'employee' } }),
    )) as {
      photos: Array<{ id: string; mine: boolean }>;
    };
    expect(out.photos).toEqual([
      { id: 'p-1', caption: 'Snow', createdAt: '2026-09-01T10:00:00.000Z', mine: true },
      { id: 'p-2', caption: '#launch', createdAt: '2026-09-01T11:00:00.000Z', mine: false },
    ]);
  });
});
