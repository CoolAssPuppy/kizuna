import type { AppSupabaseClient, Joined } from '@/lib/supabase';
import { flatJoin } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import type { ParsedRoom } from '../room-assignment/csv';

export type AccommodationRow = Pick<
  Database['public']['Tables']['accommodations']['Row'],
  | 'id'
  | 'event_id'
  | 'hotel_name'
  | 'room_number'
  | 'room_type'
  | 'description'
  | 'size_sqm'
  | 'is_suite'
  | 'capacity'
  | 'check_in'
  | 'check_out'
>;

export interface RoomWithOccupants extends AccommodationRow {
  occupants: Array<{
    user_id: string;
    full_name: string;
    email: string;
  }>;
}

export interface AssignableUser {
  user_id: string;
  full_name: string;
  email: string;
  role: Database['public']['Enums']['user_role'];
  is_leadership: boolean;
  has_dependents: boolean;
  /**
   * The registrations.created_at for this user/event. Drives the
   * "earliest registrations get the largest rooms" rule in the
   * auto-assign engine. Earlier ISO strings sort before later ones.
   */
  registration_created_at: string;
}

type JoinedUser = Joined<{
  email: string;
  employee_profiles: Joined<{
    preferred_name: string | null;
    first_name: string | null;
    last_name: string | null;
    legal_name: string | null;
  }>;
  guest_profiles: Joined<{ first_name: string; last_name: string }>;
}>;

interface OccupantShape {
  user_id: string;
  user: JoinedUser;
}

function nameFromUserShape(user: JoinedUser): { name: string; email: string } {
  const flat = flatJoin(user);
  const employee = flatJoin(flat?.employee_profiles);
  const guest = flatJoin(flat?.guest_profiles);
  const guestName =
    guest?.first_name && guest?.last_name ? `${guest.first_name} ${guest.last_name}` : null;
  const name =
    employee?.preferred_name ??
    employee?.legal_name ??
    (employee?.first_name && employee?.last_name
      ? `${employee.first_name} ${employee.last_name}`
      : null) ??
    guestName ??
    flat?.email ??
    '';
  return { name, email: flat?.email ?? '' };
}

export async function fetchRooms(
  client: AppSupabaseClient,
  eventId: string,
): Promise<RoomWithOccupants[]> {
  const { data, error } = await client
    .from('accommodations')
    .select(
      `
      id, event_id, hotel_name, room_number, room_type, description,
      size_sqm, is_suite, capacity, check_in, check_out,
      occupants:accommodation_occupants (
        user_id,
        user:users!accommodation_occupants_user_id_fkey (
          email,
          employee_profiles ( preferred_name, first_name, last_name, legal_name ),
          guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
        )
      )
    `,
    )
    .eq('event_id', eventId)
    .order('room_number', { ascending: true });
  if (error) throw error;
  type Row = AccommodationRow & { occupants: OccupantShape[] };
  return ((data ?? []) as unknown as Row[]).map(
    (row): RoomWithOccupants => ({
      id: row.id,
      event_id: row.event_id,
      hotel_name: row.hotel_name,
      room_number: row.room_number,
      room_type: row.room_type,
      description: row.description,
      size_sqm: row.size_sqm,
      is_suite: row.is_suite,
      capacity: row.capacity,
      check_in: row.check_in,
      check_out: row.check_out,
      occupants: (row.occupants ?? []).map((occ) => {
        const { name, email } = nameFromUserShape(occ.user);
        return { user_id: occ.user_id, full_name: name, email };
      }),
    }),
  );
}

export async function fetchAssignableAttendees(
  client: AppSupabaseClient,
  eventId: string,
): Promise<AssignableUser[]> {
  const { data, error } = await client
    .from('registrations')
    .select(
      `
      created_at,
      user:users!registrations_user_id_fkey (
        id, email, role, is_leadership,
        employee_profiles ( preferred_name, first_name, last_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .eq('event_id', eventId);
  if (error) throw error;

  // Pull additional_guests separately so we can flag people who have
  // minor dependents (used by the auto-assign rules).
  const { data: dependents } = await client.from('additional_guests').select('sponsor_id');
  const sponsorIdsWithDependents = new Set((dependents ?? []).map((d) => d.sponsor_id));

  type Row = {
    created_at: string;
    user: Joined<{
      id: string;
      email: string;
      role: Database['public']['Enums']['user_role'];
      is_leadership: boolean;
      employee_profiles: Joined<{
        preferred_name: string | null;
        first_name: string | null;
        last_name: string | null;
        legal_name: string | null;
      }>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>;
  };
  return ((data ?? []) as unknown as Row[])
    .map((row): AssignableUser | null => {
      const u = flatJoin(row.user);
      if (!u) return null;
      const { name, email } = nameFromUserShape(row.user);
      return {
        user_id: u.id,
        full_name: name,
        email,
        role: u.role,
        is_leadership: u.is_leadership,
        has_dependents: sponsorIdsWithDependents.has(u.id),
        registration_created_at: row.created_at,
      };
    })
    .filter((row): row is AssignableUser => row !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function importRoomBlock(
  client: AppSupabaseClient,
  args: {
    eventId: string;
    hotelName: string;
    checkIn: string;
    checkOut: string;
    rooms: ReadonlyArray<ParsedRoom>;
  },
): Promise<{ inserted: number }> {
  if (args.rooms.length === 0) return { inserted: 0 };
  const payload = args.rooms.map((room) => ({
    event_id: args.eventId,
    hotel_name: args.hotelName,
    room_number: room.room_number,
    room_type: room.is_suite ? 'suite' : 'standard',
    description: room.description,
    size_sqm: room.size_sqm,
    is_suite: room.is_suite,
    capacity: room.capacity,
    check_in: args.checkIn,
    check_out: args.checkOut,
  }));
  const { data, error } = await client.from('accommodations').insert(payload).select('id');
  if (error) throw error;
  return { inserted: data?.length ?? 0 };
}

export async function assignOccupant(
  client: AppSupabaseClient,
  args: { accommodationId: string; userId: string; isPrimary: boolean },
): Promise<void> {
  const { error } = await client.from('accommodation_occupants').insert({
    accommodation_id: args.accommodationId,
    user_id: args.userId,
    is_primary: args.isPrimary,
  });
  if (error) throw error;
}

/**
 * Bulk version of assignOccupant. Used by the auto-assign mutation —
 * a 60-room block + 60 attendees would otherwise generate 60 sequential
 * round trips. One round trip via bulk insert is the correct path.
 */
export async function assignOccupantsBulk(
  client: AppSupabaseClient,
  rows: ReadonlyArray<{ accommodationId: string; userId: string; isPrimary: boolean }>,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    accommodation_id: r.accommodationId,
    user_id: r.userId,
    is_primary: r.isPrimary,
  }));
  const { error } = await client.from('accommodation_occupants').insert(payload);
  if (error) throw error;
}

export async function removeOccupant(
  client: AppSupabaseClient,
  args: { accommodationId: string; userId: string },
): Promise<void> {
  const { error } = await client
    .from('accommodation_occupants')
    .delete()
    .eq('accommodation_id', args.accommodationId)
    .eq('user_id', args.userId);
  if (error) throw error;
}
