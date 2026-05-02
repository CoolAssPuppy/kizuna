// me-roommates makes two queries to the same table and the cheap
// mock cannot distinguish them, so this suite focuses on the no-room
// branch (which exercises the early return) and the shape of the
// happy path via stubbing the Supabase client directly.

import { describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '../context';
import { getCommand } from '../registry';
import { createCtx, createMockSupabase } from './_testHelpers';

import './me-roommates';

describe('me roommates', () => {
  it('returns no room when the user has no accommodation row', async () => {
    const supabase = createMockSupabase({ tables: { accommodation_occupants: [] } });
    const cmd = getCommand(['me', 'roommates'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(out).toEqual({ room: null, roommates: [] });
  });

  it('returns the roommate list excluding the caller', async () => {
    const myRow = {
      accommodation_id: 'a-1',
      accommodations: [{ hotel_name: 'Lodge', room_number: '12', room_type: 'double' }],
    };
    const occupants = [
      { user_id: 'u-1', users: [{ email: 'me@example.com' }] },
      { user_id: 'u-2', users: [{ email: 'other@example.com' }] },
    ];

    const supabase = makeStubClient(myRow, occupants);
    const cmd = getCommand(['me', 'roommates'])!;
    const out = await cmd.handler(
      {},
      createCtx({
        supabase,
        user: { id: 'u-1', email: 'me@example.com', role: 'employee' },
      }),
    );
    expect(out).toEqual({
      room: { hotelName: 'Lodge', roomNumber: '12', roomType: 'double' },
      roommates: [{ userId: 'u-2', email: 'other@example.com' }],
    });
  });
});

function makeStubClient(myRow: unknown, occupants: unknown[]): CommandContext['supabase'] {
  let call = 0;
  return {
    from: vi.fn(() => {
      call += 1;
      if (call === 1) {
        // First query: my accommodation_occupants row.
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: myRow, error: null }),
            }),
          }),
        };
      }
      // Second query: all occupants for that accommodation.
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: occupants, error: null }),
        }),
      };
    }),
  } as unknown as CommandContext['supabase'];
}
