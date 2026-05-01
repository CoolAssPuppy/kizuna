import { describe, expect, it } from 'vitest';

import type { PassengerRow, VehicleOption } from '../api/groundTransport';
import {
  bucketByPickup,
  flightCohortVehicles,
  flightKey,
  rankVehiclesForPassenger,
  scoreVehicleForPassenger,
} from './grouping';

function passenger(overrides: Partial<PassengerRow> = {}): PassengerRow {
  return {
    flight_id: 'f-1',
    user_id: 'u-1',
    full_name: 'Alice',
    email: 'a@x',
    origin: 'SFO',
    destination: 'YYC',
    flight_number: '101',
    airline: 'Air Canada',
    pickup_at: '2027-01-11T21:00:00.000Z',
    pickup_tz: 'America/Edmonton',
    passenger_count: 1,
    bag_count: 1,
    transport_request_id: null,
    assigned_vehicle_id: null,
    needs_review: false,
    ...overrides,
  };
}

function vehicle(overrides: Partial<VehicleOption> = {}): VehicleOption {
  return {
    id: 'v-1',
    vehicle_name: 'Shuttle A',
    capacity_passengers: 8,
    capacity_bags: 12,
    pickup_at: '2027-01-11T21:00:00.000Z',
    pickup_tz: 'America/Edmonton',
    direction: 'arrival',
    ...overrides,
  };
}

describe('bucketByPickup', () => {
  it('returns an empty list when no rows are passed', () => {
    expect(bucketByPickup([], 'origin')).toEqual([]);
  });

  it('places passengers within the same 30-min window in one bucket', () => {
    const rows = [
      passenger({ user_id: 'u-1', pickup_at: '2027-01-11T21:00:00.000Z' }),
      passenger({ user_id: 'u-2', pickup_at: '2027-01-11T21:25:00.000Z' }),
      passenger({ user_id: 'u-3', pickup_at: '2027-01-11T22:00:00.000Z' }),
    ];
    const windows = bucketByPickup(rows, 'origin');
    expect(windows).toHaveLength(2);
    expect(windows[0]?.totalPassengers).toBe(2);
    expect(windows[1]?.totalPassengers).toBe(1);
  });

  it('sub-groups passengers within a window by shared flight tuple', () => {
    const rows = [
      passenger({ user_id: 'u-1', airline: 'Air Canada', flight_number: '101' }),
      passenger({ user_id: 'u-2', airline: 'Air Canada', flight_number: '101' }),
      passenger({ user_id: 'u-3', airline: 'WestJet', flight_number: '220' }),
    ];
    const [win] = bucketByPickup(rows, 'origin');
    expect(win?.flights).toHaveLength(2);
    const ac = win!.flights.find((f) => f.flightNumber === '101');
    expect(ac?.passengers).toHaveLength(2);
  });

  it('rolls up bag totals at both window and flight scope', () => {
    const rows = [
      passenger({ user_id: 'u-1', bag_count: 2 }),
      passenger({ user_id: 'u-2', bag_count: 3 }),
    ];
    const [win] = bucketByPickup(rows, 'origin');
    expect(win?.totalBags).toBe(5);
    expect(win?.flights[0]?.totalBags).toBe(5);
  });

  it('handles boundary times at the slot edge deterministically', () => {
    // 21:30 is the start of a NEW window, not the end of the previous.
    const rows = [
      passenger({ user_id: 'u-1', pickup_at: '2027-01-11T21:29:59.000Z' }),
      passenger({ user_id: 'u-2', pickup_at: '2027-01-11T21:30:00.000Z' }),
    ];
    expect(bucketByPickup(rows, 'origin')).toHaveLength(2);
  });
});

describe('flightKey', () => {
  it('produces identical keys for two passengers on the exact same flight', () => {
    const a = passenger({ user_id: 'u-1' });
    const b = passenger({ user_id: 'u-2' });
    expect(flightKey(a)).toBe(flightKey(b));
  });

  it('differentiates flights by airline', () => {
    const a = passenger({ airline: 'Air Canada' });
    const b = passenger({ airline: 'WestJet' });
    expect(flightKey(a)).not.toBe(flightKey(b));
  });
});

describe('scoreVehicleForPassenger', () => {
  it('boosts vehicles already carrying same-flight teammates', () => {
    const p = passenger();
    const cohort = new Set<string>(['v-cohort']);
    const cohortVehicle = vehicle({ id: 'v-cohort' });
    const otherVehicle = vehicle({ id: 'v-other' });
    expect(scoreVehicleForPassenger(p, cohortVehicle, 1, cohort)).toBeGreaterThan(
      scoreVehicleForPassenger(p, otherVehicle, 0, cohort),
    );
  });

  it('prefers vehicles whose pickup_at falls in the same window', () => {
    const p = passenger({ pickup_at: '2027-01-11T21:10:00.000Z' });
    const inWindow = vehicle({ id: 'v-in', pickup_at: '2027-01-11T21:15:00.000Z' });
    const outOfWindow = vehicle({ id: 'v-out', pickup_at: '2027-01-11T22:30:00.000Z' });
    expect(scoreVehicleForPassenger(p, inWindow, 0, new Set())).toBeGreaterThan(
      scoreVehicleForPassenger(p, outOfWindow, 0, new Set()),
    );
  });

  it('pushes a full vehicle to the bottom unless it is the current assignment', () => {
    const p = passenger();
    const v = vehicle({ id: 'v-full', capacity_passengers: 4 });
    const fullScore = scoreVehicleForPassenger(p, v, 4, new Set());
    const stillCurrentScore = scoreVehicleForPassenger(
      passenger({ assigned_vehicle_id: 'v-full' }),
      v,
      4,
      new Set(),
    );
    expect(fullScore).toBeLessThan(0);
    expect(stillCurrentScore).toBeGreaterThan(fullScore);
  });
});

describe('rankVehiclesForPassenger', () => {
  it('returns vehicles ordered by score descending — best match first', () => {
    const p = passenger();
    const stats = [
      { vehicle: vehicle({ id: 'v-far', pickup_at: '2027-01-11T23:00:00.000Z' }), assigned: 0 },
      { vehicle: vehicle({ id: 'v-near', pickup_at: '2027-01-11T21:00:00.000Z' }), assigned: 0 },
    ];
    const ranked = rankVehiclesForPassenger(p, stats, new Set());
    expect(ranked[0]?.vehicle.id).toBe('v-near');
  });
});

describe('flightCohortVehicles', () => {
  it('collects vehicle ids assigned to other passengers on the same flight', () => {
    const me = passenger({ user_id: 'u-me' });
    const teammate = passenger({ user_id: 'u-mate', assigned_vehicle_id: 'v-shared' });
    const stranger = passenger({
      user_id: 'u-stranger',
      flight_number: '999',
      assigned_vehicle_id: 'v-other',
    });
    const cohort = flightCohortVehicles(me, [me, teammate, stranger]);
    expect(cohort.has('v-shared')).toBe(true);
    expect(cohort.has('v-other')).toBe(false);
  });
});
