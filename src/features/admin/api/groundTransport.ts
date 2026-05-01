import type { AppSupabaseClient, Joined } from '@/lib/supabase';
import { flatJoin } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type TransportDirection = Database['public']['Enums']['transport_direction'];

export interface PassengerRow {
  flight_id: string;
  user_id: string;
  full_name: string;
  email: string;
  origin: string;
  destination: string;
  flight_number: string | null;
  airline: string | null;
  /** UTC pickup moment for this leg (arrival_at on inbound, departure_at on outbound). */
  pickup_at: string;
  /** IANA tz the user-visible local time should render in (always YYC for now). */
  pickup_tz: string;
  passenger_count: number;
  bag_count: number;
  /** transport_request id (if one exists) so we can update in place. */
  transport_request_id: string | null;
  /** vehicle id assigned to that transport_request, or null. */
  assigned_vehicle_id: string | null;
  /** True when the linked flight changed after a vehicle was assigned. */
  needs_review: boolean;
}

/**
 * Subset of transport_vehicles columns the Ground Transport Tool reads.
 * Sourced from the generated `Database` type so adding or renaming a
 * column in the schema flows through to a TypeScript error here.
 */
export type VehicleOption = Pick<
  Database['public']['Tables']['transport_vehicles']['Row'],
  | 'id'
  | 'vehicle_name'
  | 'capacity_passengers'
  | 'capacity_bags'
  | 'pickup_at'
  | 'pickup_tz'
  | 'direction'
>;

interface FlightRowShape {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  flight_number: string | null;
  airline: string | null;
  arrival_at: string;
  arrival_tz: string;
  departure_at: string;
  departure_tz: string;
  user: Joined<{
    email: string;
    employee_profiles: Joined<{
      preferred_name: string | null;
      first_name: string | null;
      last_name: string | null;
      legal_name: string | null;
    }>;
    guest_profiles: Joined<{ full_name: string }>;
    attendee_profiles: Joined<{
      ground_transport_need: Database['public']['Enums']['ground_transport_need'];
    }>;
  }>;
  transport_requests: Array<{
    id: string;
    direction: TransportDirection;
    passenger_count: number;
    bag_count: number;
    assigned_vehicle_id: string | null;
    needs_review: boolean;
  }>;
}

function displayName(user: FlightRowShape['user']): { name: string; email: string } {
  const flat = flatJoin(user);
  const employee = flatJoin(flat?.employee_profiles);
  const guest = flatJoin(flat?.guest_profiles);
  const name =
    employee?.preferred_name ??
    employee?.legal_name ??
    (employee?.first_name && employee?.last_name
      ? `${employee.first_name} ${employee.last_name}`
      : null) ??
    guest?.full_name ??
    flat?.email ??
    '';
  return { name, email: flat?.email ?? '' };
}

function attendeeNeed(
  user: FlightRowShape['user'],
): Database['public']['Enums']['ground_transport_need'] {
  const flat = flatJoin(user);
  const profile = flatJoin(flat?.attendee_profiles);
  return profile?.ground_transport_need ?? 'none';
}

/** Maps a transport_direction onto the matching flight_direction. */
const FLIGHT_DIRECTION = {
  arrival: 'inbound',
  departure: 'outbound',
} as const;

/**
 * Loads every flight for the requested leg, filtered to passengers whose
 * attendee_profiles.ground_transport_need covers this direction. The
 * Ground Transport Tool calls this twice (once per direction) so the
 * Arrival and Departure tabs each render only their relevant audience.
 */
export async function fetchPassengers(
  client: AppSupabaseClient,
  direction: TransportDirection,
): Promise<PassengerRow[]> {
  const flightDirection = FLIGHT_DIRECTION[direction];

  const flights = await client
    .from('flights')
    .select(
      `
      id, user_id, origin, destination,
      flight_number, airline,
      arrival_at, arrival_tz, departure_at, departure_tz,
      user:users!flights_user_id_fkey (
        email,
        employee_profiles ( preferred_name, first_name, last_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( full_name ),
        attendee_profiles ( ground_transport_need )
      ),
      transport_requests ( id, direction, passenger_count, bag_count, assigned_vehicle_id, needs_review )
    `,
    )
    .eq('direction', flightDirection)
    // Tentative flights are excluded from manifests by schema convention
    // (see comment on flights.is_confirmed). Match the contract here so
    // admins never assign a vehicle to a flight that hasn't been booked.
    .eq('is_confirmed', true)
    .order(direction === 'arrival' ? 'arrival_at' : 'departure_at', { ascending: true });
  if (flights.error) throw flights.error;

  return ((flights.data ?? []) as unknown as FlightRowShape[])
    .filter((row) => {
      const need = attendeeNeed(row.user);
      return need === 'both' || need === direction;
    })
    .map((row) => {
      const { name, email } = displayName(row.user);
      // transport_requests is keyed by user; a single user can hold both
      // arrival and departure rows. Pick the request matching this leg
      // so the badge state and assignment stay aligned.
      const transport = row.transport_requests?.find((tr) => tr.direction === direction) ?? null;
      const pickupAt = direction === 'arrival' ? row.arrival_at : row.departure_at;
      // pickup_tz reads from the flight itself (arrival_tz on inbound,
      // departure_tz on outbound = the YYC venue tz) so a future event in
      // a different city renders correctly without code changes.
      const pickupTz = direction === 'arrival' ? row.arrival_tz : row.departure_tz;
      return {
        flight_id: row.id,
        user_id: row.user_id,
        full_name: name,
        email,
        origin: row.origin,
        destination: row.destination,
        flight_number: row.flight_number,
        airline: row.airline,
        pickup_at: pickupAt,
        pickup_tz: pickupTz,
        passenger_count: transport?.passenger_count ?? 1,
        bag_count: transport?.bag_count ?? 1,
        transport_request_id: transport?.id ?? null,
        assigned_vehicle_id: transport?.assigned_vehicle_id ?? null,
        needs_review: transport?.needs_review ?? false,
      };
    });
}

export async function fetchVehicleOptions(
  client: AppSupabaseClient,
  eventId: string,
  direction: TransportDirection,
): Promise<VehicleOption[]> {
  const { data, error } = await client
    .from('transport_vehicles')
    .select('id, vehicle_name, capacity_passengers, capacity_bags, pickup_at, pickup_tz, direction')
    .eq('event_id', eventId)
    .eq('direction', direction)
    .order('pickup_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface CreateVehicleArgs {
  eventId: string;
  vehicleName: string;
  direction: TransportDirection;
  pickupAtIso: string;
  pickupTz: string;
  capacityPassengers: number;
  capacityBags: number;
}

export async function createVehicle(
  client: AppSupabaseClient,
  args: CreateVehicleArgs,
): Promise<void> {
  const { error } = await client.from('transport_vehicles').insert({
    event_id: args.eventId,
    vehicle_name: args.vehicleName,
    direction: args.direction,
    pickup_at: args.pickupAtIso,
    pickup_tz: args.pickupTz,
    capacity_passengers: args.capacityPassengers,
    capacity_bags: args.capacityBags,
  });
  if (error) throw error;
}

export interface AssignVehicleArgs {
  userId: string;
  flightId: string;
  direction: TransportDirection;
  pickupAtIso: string;
  pickupTz: string;
  transportRequestId: string | null;
  vehicleId: string | null;
}

export async function assignVehicle(
  client: AppSupabaseClient,
  args: AssignVehicleArgs,
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
    direction: args.direction,
    pickup_at: args.pickupAtIso,
    pickup_tz: args.pickupTz,
    passenger_count: 1,
    bag_count: 1,
    assigned_vehicle_id: args.vehicleId,
  });
  if (error) throw error;
}
