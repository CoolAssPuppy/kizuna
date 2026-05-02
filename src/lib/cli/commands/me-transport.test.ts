import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx, createMockSupabase } from './_testHelpers';

import './me-transport';

describe('me transport', () => {
  it('shapes transport requests', async () => {
    const supabase = createMockSupabase({
      tables: {
        transport_requests: [
          {
            id: 't-1',
            direction: 'arrival',
            pickup_at: '2026-09-01T12:00:00.000Z',
            needs_review: false,
          },
        ],
      },
    });
    const cmd = getCommand(['me', 'transport'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      requests: Array<{ id: string }>;
    };
    expect(out.requests).toEqual([
      { id: 't-1', direction: 'arrival', pickupAt: '2026-09-01T12:00:00.000Z', needsReview: false },
    ]);
  });

  it('returns empty when there are no requests', async () => {
    const supabase = createMockSupabase({ tables: { transport_requests: [] } });
    const cmd = getCommand(['me', 'transport'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as { requests: unknown[] };
    expect(out.requests).toEqual([]);
  });
});
