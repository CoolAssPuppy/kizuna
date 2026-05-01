import type { AppSupabaseClient, Joined } from '@/lib/supabase';
import { flatJoin } from '@/lib/supabase';

export interface ArrivalRow {
  flight_id: string;
  user_id: string;
  full_name: string;
  email: string;
  origin: string;
  flight_number: string | null;
  airline: string | null;
  arrival_at: string;
  arrival_tz: string;
  passenger_count: number;
  bag_count: number;
  /** Hotel name + room number, or null when not yet assigned. */
  assigned_room_label: string | null;
  /** accommodation_id of current room, or null. */
  assigned_accommodation_id: string | null;
  /** transport_request id (if one exists) so we can update in place. */
  transport_request_id: string | null;
  /** vehicle id assigned to that transport_request, or null. */
  assigned_vehicle_id: string | null;
}

export interface AccommodationOption {
  id: string;
  hotel_name: string;
  room_number: string | null;
  capacity: number;
  occupied: number;
}

export interface VehicleOption {
  id: string;
  vehicle_name: string;
  capacity_passengers: number;
  capacity_bags: number;
}

interface FlightRowShape {
  id: string;
  user_id: string;
  origin: string;
  flight_number: string | null;
  airline: string | null;
  arrival_at: string;
  arrival_tz: string;
  user: Joined<{
    email: string;
    employee_profiles: Joined<{
      preferred_name: string | null;
      first_name: string | null;
      last_name: string | null;
      legal_name: string | null;
    }>;
    guest_profiles: Joined<{ full_name: string }>;
  }>;
  transport_requests: Array<{
    id: string;
    passenger_count: number;
    bag_count: number;
    assigned_vehicle_id: string | null;
  }>;
}

interface OccupantRowShape {
  user_id: string;
  accommodation_id: string;
  accommodations: Joined<{
    id: string;
    hotel_name: string;
    room_number: string | null;
  }>;
}

function displayName(user: FlightRowShape['user']): { name: string; email: string } {
  const flat = flatJoin(user);
  const employee = flatJoin(flat?.employee_profiles);
  const guest = flatJoin(flat?.guest_profiles);
  const name =
    employee?.preferred_name
      ?? employee?.legal_name
      ?? (employee?.first_name && employee?.last_name
        ? `${employee.first_name} ${employee.last_name}`
        : null)
      ?? guest?.full_name
      ?? flat?.email
      ?? '';
  return { name, email: flat?.email ?? '' };
}

/**
 * Loads every inbound flight for the given event with its passenger
 * details, the linked transport_request (if any), and the user's room
 * assignment (if any), sorted by arrival time. The admin Arrivals
 * screen renders these as a single table with inline assign affordances.
 */
export async function fetchArrivals(
  client: AppSupabaseClient,
  eventId: string,
): Promise<ArrivalRow[]> {
  const flights = await client
    .from('flights')
    .select(
      `
      id, user_id, origin, flight_number, airline, arrival_at, arrival_tz,
      user:users!flights_user_id_fkey (
        email,
        employee_profiles (
          preferred_name, first_name, last_name, legal_name
        ),
        guest_profiles!guest_profiles_user_id_fkey ( full_name )
      ),
      transport_requests ( id, passenger_count, bag_count, assigned_vehicle_id )
    `,
    )
    .eq('direction', 'inbound')
    .order('arrival_at', { ascending: true });
  if (flights.error) throw flights.error;

  const occupants = await client
    .from('accommodation_occupants')
    .select(
      `
      user_id,
      accommodation_id,
      accommodations!inner ( id, hotel_name, room_number, event_id )
    `,
    )
    .eq('accommodations.event_id', eventId);
  if (occupants.error) throw occupants.error;

  const roomByUser = new Map<string, { id: string; label: string }>();
  for (const occ of (occupants.data ?? []) as unknown as OccupantRowShape[]) {
    const acc = flatJoin(occ.accommodations);
    if (!acc) continue;
    const label = acc.room_number
      ? `${acc.hotel_name} · ${acc.room_number}`
      : acc.hotel_name;
    roomByUser.set(occ.user_id, { id: acc.id, label });
  }

  return ((flights.data ?? []) as unknown as FlightRowShape[]).map((row) => {
    const { name, email } = displayName(row.user);
    const transport = row.transport_requests?.[0];
    const room = roomByUser.get(row.user_id);
    return {
      flight_id: row.id,
      user_id: row.user_id,
      full_name: name,
      email,
      origin: row.origin,
      flight_number: row.flight_number,
      airline: row.airline,
      arrival_at: row.arrival_at,
      arrival_tz: row.arrival_tz,
      passenger_count: transport?.passenger_count ?? 1,
      bag_count: transport?.bag_count ?? 1,
      assigned_room_label: room?.label ?? null,
      assigned_accommodation_id: room?.id ?? null,
      transport_request_id: transport?.id ?? null,
      assigned_vehicle_id: transport?.assigned_vehicle_id ?? null,
    };
  });
}

export async function fetchAccommodationOptions(
  client: AppSupabaseClient,
  eventId: string,
): Promise<AccommodationOption[]> {
  const { data, error } = await client
    .from('accommodations')
    .select('id, hotel_name, room_number, room_type, accommodation_occupants(count)')
    .eq('event_id', eventId)
    .order('hotel_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    hotel_name: row.hotel_name,
    room_number: row.room_number,
    // For now: family rooms hold 4, suites 3, others 2. Tune when we have real data.
    capacity: row.room_type === 'family' ? 4 : row.room_type === 'suite' ? 3 : 2,
    occupied:
      Array.isArray(row.accommodation_occupants)
        ? (row.accommodation_occupants[0]?.count ?? 0)
        : 0,
  }));
}

export async function fetchVehicleOptions(
  client: AppSupabaseClient,
  eventId: string,
): Promise<VehicleOption[]> {
  const { data, error } = await client
    .from('transport_vehicles')
    .select('id, vehicle_name, capacity_passengers, capacity_bags')
    .eq('event_id', eventId)
    .order('vehicle_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function assignRoom(
  client: AppSupabaseClient,
  args: { userId: string; accommodationId: string | null; eventId: string },
): Promise<void> {
  // Replace the user's room assignment for this event in one transaction-y
  // dance: drop their existing occupant rows for any room of this event,
  // then insert the new one if non-null.
  const drop = await client
    .from('accommodation_occupants')
    .delete()
    .eq('user_id', args.userId)
    .in(
      'accommodation_id',
      // Limit deletion to rooms in this event so we don't touch other events.
      (
        await client
          .from('accommodations')
          .select('id')
          .eq('event_id', args.eventId)
      ).data?.map((a) => a.id) ?? [],
    );
  if (drop.error) throw drop.error;

  if (args.accommodationId) {
    const { error } = await client
      .from('accommodation_occupants')
      .insert({
        user_id: args.userId,
        accommodation_id: args.accommodationId,
        is_primary: false,
      });
    if (error) throw error;
  }
}

export async function assignVehicle(
  client: AppSupabaseClient,
  args: {
    userId: string;
    flightId: string;
    pickupAtIso: string;
    pickupTz: string;
    transportRequestId: string | null;
    vehicleId: string | null;
  },
): Promise<void> {
  if (args.transportRequestId) {
    const { error } = await client
      .from('transport_requests')
      .update({
        assigned_vehicle_id: args.vehicleId,
        needs_review: false,
      })
      .eq('id', args.transportRequestId);
    if (error) throw error;
    return;
  }

  // No request yet — create one tied to the flight.
  const { error } = await client.from('transport_requests').insert({
    user_id: args.userId,
    flight_id: args.flightId,
    direction: 'arrival',
    pickup_datetime: args.pickupAtIso,
    pickup_tz: args.pickupTz,
    passenger_count: 1,
    bag_count: 1,
    assigned_vehicle_id: args.vehicleId,
  });
  if (error) throw error;
}
