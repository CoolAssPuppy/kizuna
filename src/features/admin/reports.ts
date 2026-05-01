import type { AppSupabaseClient } from '@/lib/supabase';

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
  hotel: string;
  room_number: string | null;
  room_type: string;
  check_in: string;
  check_out: string;
  guest_name: string;
  guest_email: string;
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
        users ( email )
      )
    `,
    )
    .eq('event_id', eventId)
    .order('hotel_name', { ascending: true });

  if (error) throw error;

  const rows: RoomingRow[] = [];
  for (const room of data ?? []) {
    const occupants = (room.accommodation_occupants ?? []) as Array<{
      is_primary: boolean;
      users: { email: string } | null;
    }>;
    if (occupants.length === 0) {
      rows.push({
        hotel: room.hotel_name,
        room_number: room.room_number,
        room_type: room.room_type,
        check_in: room.check_in,
        check_out: room.check_out,
        guest_name: '(unassigned)',
        guest_email: '',
        is_primary: false,
        special_requests: room.special_requests,
      });
      continue;
    }
    for (const occ of occupants) {
      rows.push({
        hotel: room.hotel_name,
        room_number: room.room_number,
        room_type: room.room_type,
        check_in: room.check_in,
        check_out: room.check_out,
        guest_name: occ.users?.email ?? '',
        guest_email: occ.users?.email ?? '',
        is_primary: occ.is_primary,
        special_requests: room.special_requests,
      });
    }
  }
  return rows;
}

export interface DietaryRow extends CsvRow {
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
      users ( email )
    `,
    )
    .order('severity', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    email: (row.users as { email: string } | null)?.email ?? '',
    restrictions: row.restrictions.join(', '),
    allergies: row.allergies.join(', '),
    alcohol_free: row.alcohol_free,
    severity: row.severity,
    notes: row.notes,
  }));
}

export interface SwagOrderRow extends CsvRow {
  email: string;
  item: string;
  size: string | null;
  fit_preference: string | null;
  opted_in: boolean;
}

export async function fetchSwagOrder(client: AppSupabaseClient): Promise<SwagOrderRow[]> {
  const { data, error } = await client
    .from('swag_selections')
    .select(
      `
      opted_in, size, fit_preference,
      swag_items ( name ),
      users ( email )
    `,
    )
    .order('user_id', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    email: (row.users as { email: string } | null)?.email ?? '',
    item: (row.swag_items as { name: string } | null)?.name ?? '',
    size: row.size,
    fit_preference: row.fit_preference,
    opted_in: row.opted_in,
  }));
}

export interface PaymentReconciliationRow extends CsvRow {
  email: string;
  full_name: string;
  payment_status: string;
  fee_amount: number | null;
  stripe_payment_id: string | null;
}

export async function fetchPaymentReconciliation(
  client: AppSupabaseClient,
): Promise<PaymentReconciliationRow[]> {
  const { data, error } = await client
    .from('guest_profiles')
    .select(
      `
      full_name, payment_status, fee_amount, stripe_payment_id,
      user:users!guest_profiles_user_id_fkey ( email )
    `,
    )
    .order('payment_status', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    email: (row.user as unknown as { email: string } | null)?.email ?? '',
    full_name: row.full_name,
    payment_status: row.payment_status,
    fee_amount: row.fee_amount,
    stripe_payment_id: row.stripe_payment_id,
  }));
}

export interface TransportManifestRow extends CsvRow {
  direction: string;
  pickup_datetime: string;
  pickup_tz: string;
  email: string;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  passenger_count: number;
  bag_count: number;
  special_equipment: string;
  vehicle: string | null;
  needs_review: boolean;
}

export async function fetchTransportManifest(
  client: AppSupabaseClient,
): Promise<TransportManifestRow[]> {
  const { data, error } = await client
    .from('transport_requests')
    .select(
      `
      direction, pickup_datetime, pickup_tz, passenger_count, bag_count,
      special_equipment, needs_review,
      users ( email ),
      flights ( flight_number, airline, origin, destination ),
      transport_vehicles ( vehicle_name )
    `,
    )
    .order('pickup_datetime', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const flight = row.flights;
    const vehicle = row.transport_vehicles;
    return {
      direction: row.direction,
      pickup_datetime: row.pickup_datetime,
      pickup_tz: row.pickup_tz,
      email: row.users?.email ?? '',
      flight_number: flight?.flight_number ?? null,
      airline: flight?.airline ?? null,
      origin: flight?.origin ?? null,
      destination: flight?.destination ?? null,
      passenger_count: row.passenger_count,
      bag_count: row.bag_count,
      special_equipment: row.special_equipment.join(', '),
      vehicle: vehicle?.vehicle_name ?? null,
      needs_review: row.needs_review,
    };
  });
}

export interface RegistrationProgressRow extends CsvRow {
  email: string;
  role: string;
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
      user:users!registrations_user_id_fkey ( email, role )
    `,
    )
    .eq('event_id', eventId)
    .order('completion_pct', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const u = row.user as unknown as { email: string; role: string } | null;
    return {
      email: u?.email ?? '',
      role: u?.role ?? '',
      completion_pct: row.completion_pct,
      status: row.status,
    };
  });
}
