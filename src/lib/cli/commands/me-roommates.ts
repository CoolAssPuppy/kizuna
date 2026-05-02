import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { CommonInput } from './_schemas.ts';
import { first, type MaybeArray } from './_shared.ts';

interface AccommodationRow {
  hotel_name: string;
  room_number: string | null;
  room_type: string;
}

interface MyOccupantRow {
  accommodation_id: string;
  accommodations: MaybeArray<AccommodationRow>;
}

interface OccupantRow {
  user_id: string;
  users: MaybeArray<{ email: string }>;
}

export const MeRoommatesOutput = z.object({
  room: z
    .object({
      hotelName: z.string(),
      roomNumber: z.string().nullable(),
      roomType: z.string(),
    })
    .nullable(),
  roommates: z.array(z.object({ userId: z.string(), email: z.string() })),
});

registerCommand({
  path: ['me', 'roommates'],
  summaryKey: 'cli.commands.meRoommates.summary',
  descriptionKey: 'cli.commands.meRoommates.description',
  examples: ['me roommates'],
  scope: 'user',
  input: CommonInput,
  output: MeRoommatesOutput,
  handler: async (_input, ctx) => {
    const { data: mineRaw, error } = await ctx.supabase
      .from('accommodation_occupants')
      .select('accommodation_id, accommodations ( hotel_name, room_number, room_type )')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (error) throw error;
    const mine = mineRaw as MyOccupantRow | null;
    if (!mine) return { room: null, roommates: [] };

    const accommodation = first(mine.accommodations);
    const { data: occupantsRaw, error: occupantError } = await ctx.supabase
      .from('accommodation_occupants')
      .select('user_id, users ( email )')
      .eq('accommodation_id', mine.accommodation_id);
    if (occupantError) throw occupantError;
    const occupants = (occupantsRaw ?? []) as OccupantRow[];

    return {
      room: accommodation
        ? {
            hotelName: accommodation.hotel_name,
            roomNumber: accommodation.room_number,
            roomType: accommodation.room_type,
          }
        : null,
      roommates: occupants
        .filter((row) => row.user_id !== ctx.user.id)
        .map((row) => ({
          userId: row.user_id,
          email: first(row.users)?.email ?? '',
        })),
    };
  },
});
