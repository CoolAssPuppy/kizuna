import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { fetchPassengers, type TransportDirection } from './groundTransport';

interface FlightShape {
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
  user: {
    email: string;
    employee_profiles: {
      preferred_name: string | null;
      first_name: string | null;
      last_name: string | null;
      legal_name: string | null;
    };
    guest_profiles: { full_name: string };
    attendee_profiles: { ground_transport_need: 'none' | 'arrival' | 'departure' | 'both' };
  };
  transport_requests: Array<{
    id: string;
    direction: TransportDirection;
    passenger_count: number;
    bag_count: number;
    assigned_vehicle_id: string | null;
    needs_review: boolean;
  }>;
}

function makeClient(rows: FlightShape[]): {
  client: AppSupabaseClient;
  selectArgs: { selectCols: string; eqs: Array<[string, unknown]>; orderBy: string };
} {
  const calls = { selectCols: '', eqs: [] as Array<[string, unknown]>, orderBy: '' };
  const builder = {
    select(cols: string) {
      calls.selectCols = cols;
      return this;
    },
    eq(col: string, val: unknown) {
      calls.eqs.push([col, val]);
      return this;
    },
    order(col: string) {
      calls.orderBy = col;
      return Promise.resolve({ data: rows, error: null });
    },
  };
  const client = {
    from: vi.fn(() => builder),
  } as unknown as AppSupabaseClient;
  return { client, selectArgs: calls };
}

function flight(overrides: Partial<FlightShape> = {}): FlightShape {
  return {
    id: 'f-1',
    user_id: 'u-1',
    origin: 'SFO',
    destination: 'YYC',
    flight_number: '101',
    airline: 'Air Canada',
    arrival_at: '2027-01-11T21:00:00.000Z',
    arrival_tz: 'America/Edmonton',
    departure_at: '2027-01-11T17:30:00.000Z',
    departure_tz: 'America/Los_Angeles',
    user: {
      email: 'a@x',
      employee_profiles: {
        preferred_name: 'Alice',
        first_name: 'Alice',
        last_name: 'Anderson',
        legal_name: 'Alice Anderson',
      },
      guest_profiles: { full_name: '' },
      attendee_profiles: { ground_transport_need: 'both' },
    },
    transport_requests: [],
    ...overrides,
  };
}

describe('fetchPassengers', () => {
  it('queries inbound flights and confirmed-only on arrival', async () => {
    const { client, selectArgs } = makeClient([flight()]);
    await fetchPassengers(client, 'arrival', 'YYC');
    expect(selectArgs.eqs).toEqual(
      expect.arrayContaining([
        ['direction', 'inbound'],
        ['is_confirmed', true],
      ]),
    );
    expect(selectArgs.orderBy).toBe('arrival_at');
  });

  it('queries outbound flights and orders by departure_at on departure', async () => {
    const { client, selectArgs } = makeClient([
      flight({
        user: {
          email: 'b@x',
          employee_profiles: {
            preferred_name: 'Bob',
            first_name: 'Bob',
            last_name: 'Brown',
            legal_name: 'Bob Brown',
          },
          guest_profiles: { full_name: '' },
          attendee_profiles: { ground_transport_need: 'departure' },
        },
      }),
    ]);
    await fetchPassengers(client, 'departure', 'YYC');
    expect(selectArgs.eqs).toEqual(expect.arrayContaining([['direction', 'outbound']]));
    expect(selectArgs.orderBy).toBe('departure_at');
  });

  it('drops passengers whose ground_transport_need does not cover this direction', async () => {
    const { client } = makeClient([
      flight({
        user_id: 'u-keep',
        user: {
          email: 'k@x',
          employee_profiles: {
            preferred_name: 'Keep',
            first_name: 'Keep',
            last_name: 'Me',
            legal_name: 'Keep Me',
          },
          guest_profiles: { full_name: '' },
          attendee_profiles: { ground_transport_need: 'arrival' },
        },
      }),
      flight({
        user_id: 'u-drop',
        user: {
          email: 'd@x',
          employee_profiles: {
            preferred_name: 'Drop',
            first_name: 'Drop',
            last_name: 'Me',
            legal_name: 'Drop Me',
          },
          guest_profiles: { full_name: '' },
          attendee_profiles: { ground_transport_need: 'departure' },
        },
      }),
    ]);
    const result = await fetchPassengers(client, 'arrival', 'YYC');
    expect(result.map((r) => r.user_id)).toEqual(['u-keep']);
  });

  it('keeps passengers whose need is "both" on either direction', async () => {
    const { client } = makeClient([
      flight({ user: { ...flight().user, attendee_profiles: { ground_transport_need: 'both' } } }),
    ]);
    const arrivals = await fetchPassengers(client, 'arrival', 'YYC');
    expect(arrivals).toHaveLength(1);
    const departures = await fetchPassengers(client, 'departure', 'YYC');
    expect(departures).toHaveLength(1);
  });

  it('uses arrival_at as pickup_at on arrival and departure_at on departure', async () => {
    const arr = '2027-01-11T21:00:00.000Z';
    const dep = '2027-01-15T18:00:00.000Z';
    const { client: arrClient } = makeClient([flight({ arrival_at: arr, departure_at: dep })]);
    const arrivals = await fetchPassengers(arrClient, 'arrival', 'YYC');
    expect(arrivals[0]?.pickup_at).toBe(arr);

    const { client: depClient } = makeClient([
      flight({
        arrival_at: arr,
        departure_at: dep,
        user: { ...flight().user, attendee_profiles: { ground_transport_need: 'both' } },
      }),
    ]);
    const departures = await fetchPassengers(depClient, 'departure', 'YYC');
    expect(departures[0]?.pickup_at).toBe(dep);
  });

  it('matches the transport_request to the same direction as the leg', async () => {
    const { client } = makeClient([
      flight({
        transport_requests: [
          {
            id: 'tr-arr',
            direction: 'arrival',
            passenger_count: 1,
            bag_count: 1,
            assigned_vehicle_id: 'v-arr',
            needs_review: false,
          },
          {
            id: 'tr-dep',
            direction: 'departure',
            passenger_count: 1,
            bag_count: 2,
            assigned_vehicle_id: 'v-dep',
            needs_review: true,
          },
        ],
      }),
    ]);
    const arrivals = await fetchPassengers(client, 'arrival', 'YYC');
    expect(arrivals[0]?.transport_request_id).toBe('tr-arr');
    expect(arrivals[0]?.assigned_vehicle_id).toBe('v-arr');
    expect(arrivals[0]?.needs_review).toBe(false);
  });
});
