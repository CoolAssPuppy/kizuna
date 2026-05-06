import { flatJoin, type AppSupabaseClient } from '@/lib/supabase';

import type { CsvRow } from './csv';
import { resolveTraveler, TRAVELER_USER_SELECT, type TravelerJoin } from './shared';

export interface RoomingRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  employee: string;
  arrival_at: string | null;
  arrival_flight: string | null;
  hotel: string;
  room_number: string | null;
  room_type: string;
  check_in: string;
  check_out: string;
  is_primary: boolean;
  special_requests: string | null;
}

export async function fetchRoomingList(
  client: AppSupabaseClient,
  eventId: string,
): Promise<RoomingRow[]> {
  const { data, error } = await client
    .from('accommodations')
    .select(
      `
      hotel_name, room_number, room_type, check_in, check_out, special_requests,
      accommodation_occupants (
        is_primary,
        users ( ${TRAVELER_USER_SELECT} )
      )
    `,
    )
    .eq('event_id', eventId)
    .order('hotel_name', { ascending: true });

  if (error) throw error;

  const rows: RoomingRow[] = [];
  for (const room of data ?? []) {
    const roomFields = {
      hotel: room.hotel_name,
      room_number: room.room_number,
      room_type: room.room_type,
      check_in: room.check_in,
      check_out: room.check_out,
      special_requests: room.special_requests,
    } as const;
    const occupants = room.accommodation_occupants ?? [];
    if (occupants.length === 0) {
      rows.push({
        first_name: '(unassigned)',
        last_name: '',
        email: '',
        role: '',
        employee: '',
        arrival_at: null,
        arrival_flight: null,
        ...roomFields,
        is_primary: false,
      });
      continue;
    }
    for (const occ of occupants) {
      const traveler = resolveTraveler(flatJoin<TravelerJoin>(occ.users));
      rows.push({ ...traveler, ...roomFields, is_primary: occ.is_primary });
    }
  }
  return rows;
}
