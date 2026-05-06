import type { PassengerRow, VehicleOption } from '../api/groundTransport';

const WINDOW_MINUTES = 30;

// Formatters are built per render so the timezone reads from the active
// event — no module-level "America/Edmonton" baked in.
export function windowTimeFmt(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export interface FlightGroup {
  /** Stable key: airline|flight_number|pickup_at — same value across passengers on the same flight. */
  key: string;
  airline: string;
  flightNumber: string;
  /** Origin or destination depending on direction; the screen passes whichever is informative. */
  endpoint: string;
  /** Local-time label, e.g. "14:00". */
  timeLabel: string;
  /** Total bag count across the group (driver-friendly). */
  totalBags: number;
  passengers: PassengerRow[];
}

export interface PickupWindow {
  /** ISO of window start (UTC) — used as the React key. */
  startIso: string;
  /** Display label, e.g. "Mon Jan 11 · 14:00–14:30". */
  label: string;
  totalPassengers: number;
  totalBags: number;
  flights: FlightGroup[];
}

/**
 * Bucket passengers into 30-minute pickup windows, then sub-group within
 * each window by shared flight (same airline + flight_number + time).
 * The Ground Transport Tool renders the result as: window header, then
 * one card per flight group, then passenger rows inside that card.
 */
export function bucketByPickup(
  rows: PassengerRow[],
  endpointField: 'origin' | 'destination',
  timeZone: string,
): PickupWindow[] {
  if (rows.length === 0) return [];
  const slotMs = WINDOW_MINUTES * 60_000;
  const startFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  const timeFmt = windowTimeFmt(timeZone);

  const windowMap = new Map<string, PassengerRow[]>();
  for (const row of rows) {
    const slotStart = Math.floor(new Date(row.pickup_at).getTime() / slotMs) * slotMs;
    const key = new Date(slotStart).toISOString();
    const existing = windowMap.get(key);
    if (existing) existing.push(row);
    else windowMap.set(key, [row]);
  }

  return Array.from(windowMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startIso, passengers]): PickupWindow => {
      const start = new Date(startIso);
      const end = new Date(start.getTime() + slotMs);
      const flights = groupByFlight(passengers, endpointField, timeFmt);
      return {
        startIso,
        label: `${startFmt.format(start)}–${timeFmt.format(end)}`,
        totalPassengers: passengers.length,
        totalBags: passengers.reduce((s, p) => s + p.bag_count, 0),
        flights,
      };
    });
}

function groupByFlight(
  passengers: PassengerRow[],
  endpointField: 'origin' | 'destination',
  timeFmt: Intl.DateTimeFormat,
): FlightGroup[] {
  const groups = new Map<string, PassengerRow[]>();
  for (const p of passengers) {
    const key = flightKey(p);
    const existing = groups.get(key);
    if (existing) existing.push(p);
    else groups.set(key, [p]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, members]): FlightGroup => {
      const head = members[0]!;
      return {
        key,
        airline: head.airline ?? '—',
        flightNumber: head.flight_number ?? '—',
        endpoint: head[endpointField],
        timeLabel: timeFmt.format(new Date(head.pickup_at)),
        totalBags: members.reduce((s, m) => s + m.bag_count, 0),
        passengers: members.sort((a, b) => a.full_name.localeCompare(b.full_name)),
      };
    });
}

export function flightKey(p: PassengerRow): string {
  return `${p.airline ?? ''}|${p.flight_number ?? ''}|${p.pickup_at}`;
}

export interface VehicleStat {
  vehicle: VehicleOption;
  assigned: number;
}

/**
 * Score a vehicle for one passenger; higher is a better suggestion.
 *
 * Signal weights:
 *  - +1000 if at least one teammate on this passenger's flight has ALREADY
 *    been assigned to this vehicle (keeping a flight group together is the
 *    single biggest win for ops).
 *  - +500 if the vehicle's pickup_at sits inside the same 30-min window as
 *    the passenger's pickup_at.
 *  - + (60 - |delta_minutes|) for proximity, clamped at 0. Lets us order
 *    near-window vehicles even when none falls inside the window.
 *  - + remaining_capacity. Light weight so capacity is the tiebreaker, not
 *    the headline; we don't want to hide the 'best fit' vehicle just because
 *    a less-relevant one happens to be emptier.
 *  - -10000 if the vehicle is full AND not currently assigned to this
 *    passenger. Forces it to the bottom of the list while still letting the
 *    passenger see it (useful for moving them off).
 */
export function scoreVehicleForPassenger(
  passenger: PassengerRow,
  vehicle: VehicleOption,
  assignedCount: number,
  flightCohort: ReadonlySet<string>,
): number {
  const remaining = vehicle.capacity_passengers - assignedCount;
  const isCurrent = vehicle.id === passenger.assigned_vehicle_id;
  const isFull = remaining <= 0 && !isCurrent;

  let score = 0;
  if (flightCohort.has(vehicle.id)) score += 1000;

  const slotSizeMs = WINDOW_MINUTES * 60_000;
  const passengerSlot = Math.floor(new Date(passenger.pickup_at).getTime() / slotSizeMs);
  const vehicleSlot = Math.floor(new Date(vehicle.pickup_at).getTime() / slotSizeMs);
  if (passengerSlot === vehicleSlot) score += 500;

  const deltaMin =
    Math.abs(new Date(vehicle.pickup_at).getTime() - new Date(passenger.pickup_at).getTime()) /
    60_000;
  score += Math.max(0, 60 - deltaMin);

  score += Math.max(0, remaining);

  if (isFull) score -= 10000;
  return score;
}

/**
 * Return vehicles ranked best-first for a given passenger, given the
 * current per-vehicle assignment counts and which vehicles already hold
 * other passengers from the same flight.
 */
export function rankVehiclesForPassenger(
  passenger: PassengerRow,
  vehicles: ReadonlyArray<VehicleStat>,
  flightCohort: ReadonlySet<string>,
): VehicleStat[] {
  const scored = vehicles.map((stat) => ({
    stat,
    score: scoreVehicleForPassenger(passenger, stat.vehicle, stat.assigned, flightCohort),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ stat }) => stat);
}

/**
 * For each vehicle id, the set of vehicle ids currently assigned to OTHER
 * passengers on the same flight as the input passenger. Lets the scorer
 * prefer vehicles already serving teammates on the same plane.
 */
export function flightCohortVehicles(
  passenger: PassengerRow,
  allPassengers: ReadonlyArray<PassengerRow>,
): Set<string> {
  const key = flightKey(passenger);
  const out = new Set<string>();
  for (const p of allPassengers) {
    if (p.user_id === passenger.user_id) continue;
    if (flightKey(p) !== key) continue;
    if (p.assigned_vehicle_id) out.add(p.assigned_vehicle_id);
  }
  return out;
}
