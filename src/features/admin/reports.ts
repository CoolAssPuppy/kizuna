import { joinFullName, resolveProfileName } from '@/lib/fullName';
import { type AppSupabaseClient, flatJoin, type Joined } from '@/lib/supabase';

import type { CsvRow } from './csv';

/**
 * Report query helpers. Each returns plain rows; the screen renders them
 * as tables and offers CSV export. RLS only allows admins to read these
 * tables in full, so non-admin callers receive empty arrays.
 *
 * Reports are shaped to match the spec's hotel/transport recipients —
 * keys and order matter when these are exported to CSV and emailed to
 * Fairmont and the bus operator.
 */

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

interface NameProfile {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  legal_name: string | null;
}

interface FlightLeg {
  direction: 'inbound' | 'outbound';
  arrival_at: string;
  flight_number: string | null;
}

interface InboundFlight {
  arrival_at: string;
  flight_number: string | null;
}

/**
 * Pick the user's final inbound flight leg. For multi-leg trips, the
 * latest arrival_at is the one that lands at the event hub.
 */
function pickInboundFlight(
  flights: ReadonlyArray<FlightLeg> | null | undefined,
): InboundFlight | null {
  if (!flights || flights.length === 0) return null;
  let latest: FlightLeg | null = null;
  for (const flight of flights) {
    if (flight.direction !== 'inbound') continue;
    if (!latest || flight.arrival_at > latest.arrival_at) latest = flight;
  }
  return latest ? { arrival_at: latest.arrival_at, flight_number: latest.flight_number } : null;
}

interface TravelerJoin {
  email: string;
  role: string;
  employee_profiles: Joined<NameProfile>;
  guest_profiles: Joined<{ first_name: string; last_name: string }>;
  sponsor: Joined<{
    email: string;
    employee_profiles: Joined<NameProfile>;
  }>;
  flights: FlightLeg[] | null;
}

interface TravelerFields {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  employee: string;
  arrival_at: string | null;
  arrival_flight: string | null;
}

/**
 * Resolve the seven identity + arrival columns the rooming and
 * transport reports share. `employee` is the sponsor's display name
 * for guests/dependents, empty for direct attendees.
 */
function resolveTraveler(user: TravelerJoin | null): TravelerFields {
  const { first, last } = resolveProfileName(
    flatJoin(user?.employee_profiles),
    flatJoin(user?.guest_profiles),
  );
  const sponsor = flatJoin(user?.sponsor);
  const sponsorName = sponsor
    ? resolveProfileName(flatJoin(sponsor.employee_profiles), null).full || sponsor.email
    : '';
  const inbound = pickInboundFlight(user?.flights);
  return {
    first_name: first,
    last_name: last,
    email: user?.email ?? '',
    role: user?.role ?? '',
    employee: sponsorName,
    arrival_at: inbound?.arrival_at ?? null,
    arrival_flight: inbound?.flight_number ?? null,
  };
}

const TRAVELER_USER_SELECT = `
  email, role,
  employee_profiles ( first_name, last_name, preferred_name, legal_name ),
  guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name ),
  sponsor:users!users_sponsor_id_fkey (
    email,
    employee_profiles ( first_name, last_name, preferred_name, legal_name )
  ),
  flights ( direction, arrival_at, flight_number )
`;

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

export interface DietaryRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  restrictions: string;
  allergies: string;
  alcohol_free: boolean;
  severity: string;
  notes: string | null;
}

export async function fetchDietarySummary(client: AppSupabaseClient): Promise<DietaryRow[]> {
  const { data, error } = await client
    .from('dietary_preferences')
    .select(
      `
      restrictions, allergies, alcohol_free, severity, notes,
      users (
        email,
        employee_profiles ( first_name, last_name, preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .order('severity', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const user = flatJoin<{
      email: string;
      employee_profiles: Joined<NameProfile>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>(row.users);
    const { first, last } = resolveProfileName(
      flatJoin(user?.employee_profiles),
      flatJoin(user?.guest_profiles),
    );
    return {
      first_name: first,
      last_name: last,
      email: user?.email ?? '',
      restrictions: row.restrictions.join(', '),
      allergies: row.allergies.join(', '),
      alcohol_free: row.alcohol_free,
      severity: row.severity,
      notes: row.notes,
    };
  });
}

export interface SwagOrderRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  swag_item: string;
  size: string;
  opted_out: boolean;
}

/**
 * Per-item swag order export for the ops team. One row per (attendee,
 * swag_item). opted_out rows are kept so the order vendor can see who
 * declined a piece — easier than reconciling the absence of a row.
 */
export async function fetchSwagOrder(client: AppSupabaseClient): Promise<SwagOrderRow[]> {
  const { data, error } = await client.from('swag_selections').select(
    `
      size, opted_out,
      swag_item:swag_items ( name ),
      user:users!swag_selections_user_id_fkey (
        email,
        employee_profiles ( first_name, last_name, preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      ),
      additional_guests ( first_name, last_name, sponsor:users!additional_guests_sponsor_id_fkey ( email ) )
    `,
  );
  if (error) throw error;

  return (data ?? []).map((row) => {
    const itemName = flatJoin<{ name: string }>(row.swag_item)?.name ?? '';
    const user = flatJoin<{
      email: string;
      employee_profiles: Joined<NameProfile>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>(row.user);
    const additional = flatJoin<{
      first_name: string;
      last_name: string;
      sponsor: Joined<{ email: string }>;
    }>(row.additional_guests);

    if (additional) {
      return {
        first_name: additional.first_name,
        last_name: additional.last_name,
        email: flatJoin<{ email: string }>(additional.sponsor)?.email ?? '',
        swag_item: itemName,
        size: row.size ?? '',
        opted_out: row.opted_out,
      };
    }

    const { first, last } = resolveProfileName(
      flatJoin(user?.employee_profiles),
      flatJoin(user?.guest_profiles),
    );
    return {
      first_name: first,
      last_name: last,
      email: user?.email ?? '',
      swag_item: itemName,
      size: row.size ?? '',
      opted_out: row.opted_out,
    };
  });
}

export interface SwagTotalsRow extends CsvRow {
  swag_item: string;
  size: string;
  quantity: number;
  opted_out: number;
}

/**
 * Aggregates swag selections by (item, size) so the ops team can place
 * a vendor order without flipping through one row per attendee. Counts
 * opt-outs separately under size = "(opted out)" so a quick glance
 * shows both the "to order" and "decline" buckets.
 */
export async function fetchSwagOrderTotals(client: AppSupabaseClient): Promise<SwagTotalsRow[]> {
  const { data, error } = await client
    .from('swag_selections')
    .select(`size, opted_out, swag_item:swag_items ( name )`);
  if (error) throw error;

  const buckets = new Map<string, SwagTotalsRow>();
  for (const row of data ?? []) {
    const itemName = flatJoin<{ name: string }>(row.swag_item)?.name ?? '';
    const sizeLabel = row.opted_out ? '(opted out)' : (row.size ?? '');
    const key = `${itemName} ${sizeLabel}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.quantity += row.opted_out ? 0 : 1;
      bucket.opted_out += row.opted_out ? 1 : 0;
    } else {
      buckets.set(key, {
        swag_item: itemName,
        size: sizeLabel,
        quantity: row.opted_out ? 0 : 1,
        opted_out: row.opted_out ? 1 : 0,
      });
    }
  }

  // Sort by item name, then size — gives the ops team a stable layout
  // that mirrors how the catalogue is structured.
  return [...buckets.values()].sort((a, b) => {
    if (a.swag_item !== b.swag_item) return a.swag_item.localeCompare(b.swag_item);
    return a.size.localeCompare(b.size);
  });
}

export interface PaymentReconciliationRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  guests: string;
  total_due: number;
  total_received: number;
  payment_status: string;
  stripe_payment_id: string;
}

interface GuestPaymentLeg {
  first_name: string;
  last_name: string;
  fee_amount: number | null;
  payment_status: string;
  stripe_payment_id: string | null;
}

/** Returns null when the employee has no guests so the caller can skip the row. */
function summarizePaymentLegs(legs: ReadonlyArray<GuestPaymentLeg>): {
  guests: string;
  total_due: number;
  total_received: number;
  payment_status: string;
  stripe_payment_id: string;
} | null {
  if (legs.length === 0) return null;
  let totalDue = 0;
  let totalReceived = 0;
  const guestNames: string[] = [];
  const stripeIds: string[] = [];
  const statusSet = new Set<string>();
  for (const leg of legs) {
    const fee = leg.fee_amount ?? 0;
    totalDue += fee;
    if (leg.payment_status === 'paid') totalReceived += fee;
    statusSet.add(leg.payment_status);
    const fullName = joinFullName(leg.first_name, leg.last_name);
    if (fullName) guestNames.push(fullName);
    if (leg.stripe_payment_id) stripeIds.push(leg.stripe_payment_id);
  }
  const status = statusSet.size === 1 ? [...statusSet][0]! : 'mixed';
  return {
    guests: guestNames.join(', '),
    total_due: totalDue,
    total_received: totalReceived,
    payment_status: status,
    stripe_payment_id: stripeIds.join(', '),
  };
}

export async function fetchPaymentReconciliation(
  client: AppSupabaseClient,
): Promise<PaymentReconciliationRow[]> {
  const { data, error } = await client
    .from('users')
    .select(
      `
      email,
      employee_profiles ( first_name, last_name, preferred_name, legal_name ),
      sponsored_guests:guest_profiles!guest_profiles_sponsor_id_fkey (
        first_name, last_name, fee_amount, payment_status, stripe_payment_id
      ),
      sponsored_dependents:additional_guests!additional_guests_sponsor_id_fkey (
        first_name, last_name, fee_amount, payment_status, stripe_payment_id
      )
    `,
    )
    .eq('role', 'employee');
  if (error) throw error;

  const rows: PaymentReconciliationRow[] = [];
  for (const row of data ?? []) {
    const sponsored = [
      ...(row.sponsored_guests ?? []),
      ...(row.sponsored_dependents ?? []),
    ] as GuestPaymentLeg[];
    const summary = summarizePaymentLegs(sponsored);
    if (!summary) continue;
    const { first, last } = resolveProfileName(flatJoin(row.employee_profiles), null);
    rows.push({
      first_name: first,
      last_name: last,
      email: row.email ?? '',
      ...summary,
    });
  }
  rows.sort((a, b) => a.payment_status.localeCompare(b.payment_status));
  return rows;
}

export interface TransportManifestRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  employee: string;
  arrival_at: string | null;
  arrival_flight: string | null;
  direction: string;
  pickup_at: string;
  pickup_tz: string;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  passenger_count: number;
  bag_count: number;
  special_equipment: string;
  /** Vehicle name from transport_vehicles, or null when unassigned. */
  assigned_transport: string | null;
  needs_review: boolean;
}

export async function fetchTransportManifest(
  client: AppSupabaseClient,
): Promise<TransportManifestRow[]> {
  const { data, error } = await client
    .from('transport_requests')
    .select(
      `
      direction, pickup_at, pickup_tz, passenger_count, bag_count,
      special_equipment, needs_review,
      users ( ${TRAVELER_USER_SELECT} ),
      flights ( flight_number, airline, origin, destination ),
      transport_vehicles ( vehicle_name )
    `,
    )
    .order('pickup_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const traveler = resolveTraveler(flatJoin<TravelerJoin>(row.users));
    const flight = flatJoin<{
      flight_number: string | null;
      airline: string | null;
      origin: string;
      destination: string;
    }>(row.flights);
    const vehicle = flatJoin<{ vehicle_name: string }>(row.transport_vehicles);
    return {
      ...traveler,
      direction: row.direction,
      pickup_at: row.pickup_at,
      pickup_tz: row.pickup_tz,
      flight_number: flight?.flight_number ?? null,
      airline: flight?.airline ?? null,
      origin: flight?.origin ?? null,
      destination: flight?.destination ?? null,
      passenger_count: row.passenger_count,
      bag_count: row.bag_count,
      special_equipment: row.special_equipment.join(', '),
      assigned_transport: vehicle?.vehicle_name ?? null,
      needs_review: row.needs_review,
    };
  });
}

export interface RegistrationProgressRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_leadership: boolean;
  completion_pct: number;
  status: string;
}

export async function fetchRegistrationProgress(
  client: AppSupabaseClient,
  eventId: string,
): Promise<RegistrationProgressRow[]> {
  const { data, error } = await client
    .from('registrations')
    .select(
      `
      completion_pct, status,
      user:users!registrations_user_id_fkey (
        email, role, is_leadership,
        employee_profiles ( first_name, last_name, preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      )
    `,
    )
    .eq('event_id', eventId)
    .order('completion_pct', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const u = flatJoin<{
      email: string;
      role: string;
      is_leadership: boolean;
      employee_profiles: Joined<NameProfile>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>(row.user);
    const { first, last } = resolveProfileName(
      flatJoin(u?.employee_profiles),
      flatJoin(u?.guest_profiles),
    );
    return {
      first_name: first,
      last_name: last,
      email: u?.email ?? '',
      role: u?.role ?? '',
      is_leadership: u?.is_leadership ?? false,
      completion_pct: row.completion_pct,
      status: row.status,
    };
  });
}
