import { flatJoin, type AppSupabaseClient } from '@/lib/supabase';

import type { CsvRow } from './csv';
import { resolveTraveler, TRAVELER_USER_SELECT, type TravelerJoin } from './shared';

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
