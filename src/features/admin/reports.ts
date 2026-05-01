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
        users (
          email,
          employee_profiles ( preferred_name, legal_name ),
          guest_profiles!guest_profiles_user_id_fkey ( full_name )
        )
      )
    `,
    )
    .eq('event_id', eventId)
    .order('hotel_name', { ascending: true });

  if (error) throw error;

  const rows: RoomingRow[] = [];
  for (const room of data ?? []) {
    const baseRow = {
      hotel: room.hotel_name,
      room_number: room.room_number,
      room_type: room.room_type,
      check_in: room.check_in,
      check_out: room.check_out,
      special_requests: room.special_requests,
    } as const;
    const occupants = room.accommodation_occupants ?? [];
    if (occupants.length === 0) {
      rows.push({ ...baseRow, guest_name: '(unassigned)', guest_email: '', is_primary: false });
      continue;
    }
    for (const occ of occupants) {
      const user = flatJoin<{
        email: string;
        employee_profiles: Joined<{ preferred_name: string | null; legal_name: string | null }>;
        guest_profiles: Joined<{ full_name: string }>;
      }>(occ.users);
      const email = user?.email ?? '';
      const employee = flatJoin(user?.employee_profiles);
      const guest = flatJoin(user?.guest_profiles);
      const displayName =
        employee?.preferred_name ?? employee?.legal_name ?? guest?.full_name ?? email;
      rows.push({
        ...baseRow,
        guest_name: displayName,
        guest_email: email,
        is_primary: occ.is_primary,
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
    email: flatJoin<{ email: string }>(row.users)?.email ?? '',
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
    email: flatJoin<{ email: string }>(row.users)?.email ?? '',
    item: flatJoin<{ name: string }>(row.swag_items)?.name ?? '',
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
    email: flatJoin<{ email: string }>(row.user)?.email ?? '',
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
    const flight = flatJoin<{
      flight_number: string | null;
      airline: string | null;
      origin: string;
      destination: string;
    }>(row.flights);
    const vehicle = flatJoin<{ vehicle_name: string }>(row.transport_vehicles);
    return {
      direction: row.direction,
      pickup_datetime: row.pickup_datetime,
      pickup_tz: row.pickup_tz,
      email: flatJoin<{ email: string }>(row.users)?.email ?? '',
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
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  completion_pct: number;
  status: string;
}

function splitName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first: '', last: '' };
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1) };
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
        email, role,
        employee_profiles ( preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( full_name )
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
      employee_profiles: Joined<{ preferred_name: string | null; legal_name: string | null }>;
      guest_profiles: Joined<{ full_name: string }>;
    }>(row.user);
    const employee = flatJoin(u?.employee_profiles);
    const guest = flatJoin(u?.guest_profiles);
    const fullName =
      employee?.preferred_name ?? employee?.legal_name ?? guest?.full_name ?? '';
    const { first, last } = splitName(fullName);
    return {
      first_name: first,
      last_name: last,
      email: u?.email ?? '',
      role: u?.role ?? '',
      completion_pct: row.completion_pct,
      status: row.status,
    };
  });
}
