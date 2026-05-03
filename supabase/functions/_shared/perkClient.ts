// Perk (TravelPerk) API client.
//
// Confirmed at developers.perk.com (developers.travelperk.com 301s
// here as of 2026-05-03):
//   * Base URL: https://api.travelperk.com
//   * Auth:     Authorization: apikey <KEY>
//   * Header:   Api-Version: 1
//   * Sandbox:  available; toggled by base-URL flip when Perk
//               documents the sandbox host. For now the sandbox uses
//               the same host with a sandbox-scoped API key.
//
// Modes:
//   * **Live**:    PERK_API_KEY set → real fetch.
//   * **Stubbed**: PERK_API_KEY missing → returns deterministic
//                  fixtures from `_shared/perkStub.ts`. Logs once.
//
// The shape returned is `PerkBooking` (declared in perkStub.ts) so
// the sync function and the SPA picker don't have to care which
// mode they're in.

import {
  PERK_STUB_BY_BOOKING_ID,
  PERK_STUB_BY_EMAIL,
  type PerkBooking,
  type PerkFlightSegment,
} from './perkStub.ts';

const PERK_BASE = 'https://api.travelperk.com';

interface PerkConfig {
  apiKey?: string | undefined;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
}

let stubWarned = false;

function isLive(config: PerkConfig): boolean {
  return Boolean(config.apiKey);
}

/**
 * List every active booking for one traveller email. Returns the full
 * array of bookings so the SPA can render a picker — the caller decides
 * which booking gets imported. In stub mode the directory is keyed by
 * lowercase email; in live mode we hit `/bookings?traveller_email=`.
 */
export async function listPerkBookingsForEmail(
  config: PerkConfig,
  email: string,
): Promise<ReadonlyArray<PerkBooking>> {
  if (!isLive(config)) {
    if (!stubWarned) {
      stubWarned = true;
      console.warn(
        '[perk] PERK_API_KEY missing — returning stub. Set PERK_API_KEY in Doppler to enable live lookups.',
      );
    }
    return PERK_STUB_BY_EMAIL.get(email.toLowerCase()) ?? [];
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const url = new URL(`${PERK_BASE}/bookings`);
  url.searchParams.set('traveller_email', email);

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `apikey ${config.apiKey}`,
      'Api-Version': '1',
      Accept: 'application/json',
    },
  });
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`Perk /bookings ${response.status}`);
  }
  return parseBookingsResponse(await response.json(), email);
}

/**
 * Fetch one booking by id. Used by the import step after the user
 * picks a row from the list. We deliberately re-fetch instead of
 * trusting the list payload because Perk may have updated the trip
 * (flight time change, gate change) between list and import.
 */
export async function fetchPerkBookingById(
  config: PerkConfig,
  bookingId: string,
): Promise<PerkBooking | null> {
  if (!isLive(config)) {
    return PERK_STUB_BY_BOOKING_ID.get(bookingId) ?? null;
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl(`${PERK_BASE}/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'GET',
    headers: {
      Authorization: `apikey ${config.apiKey}`,
      'Api-Version': '1',
      Accept: 'application/json',
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Perk /bookings/${bookingId} ${response.status}`);
  const bookings = parseBookingsResponse(await response.json(), '');
  return bookings[0] ?? null;
}

/**
 * Boundary-cast Perk's documented schema into our local `PerkBooking`.
 * Only the subset we map onto `public.flights` is captured.
 */
interface RawSegment {
  origin?: { iata?: string };
  destination?: { iata?: string };
  departure_datetime?: string;
  departure_timezone?: string;
  arrival_datetime?: string;
  arrival_timezone?: string;
  carrier?: { name?: string; iata?: string };
  flight_number?: string | number;
  record_locator?: string;
}
interface RawBooking {
  id?: string;
  trip_name?: string;
  trip?: { name?: string };
  traveller?: { email?: string };
  segments?: ReadonlyArray<RawSegment>;
}

function parseBookingsResponse(body: unknown, fallbackEmail: string): ReadonlyArray<PerkBooking> {
  // Two response shapes: list view returns `{ results: [...] }`, the
  // single-item view returns the booking object directly. Normalise.
  const collection = (body as { results?: ReadonlyArray<RawBooking> }).results;
  const raw = collection ?? [body as RawBooking];

  const bookings: PerkBooking[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const segments: PerkFlightSegment[] = [];
    for (const s of b.segments ?? []) {
      const origin = s.origin?.iata;
      const destination = s.destination?.iata;
      if (
        !origin ||
        !destination ||
        !s.departure_datetime ||
        !s.arrival_datetime ||
        !s.departure_timezone ||
        !s.arrival_timezone
      ) {
        continue;
      }
      segments.push({
        origin,
        destination,
        departureLocal: s.departure_datetime,
        departureTz: s.departure_timezone,
        arrivalLocal: s.arrival_datetime,
        arrivalTz: s.arrival_timezone,
        airline: s.carrier?.name ?? s.carrier?.iata ?? 'Unknown carrier',
        flightNumber: `${s.carrier?.iata ?? ''}${s.flight_number ?? ''}`.trim(),
        confirmationCode: s.record_locator ?? null,
      });
    }
    if (segments.length === 0) continue;
    bookings.push({
      bookingId: b.id ?? `tp_${fallbackEmail || 'unknown'}_${bookings.length}`,
      travellerEmail: b.traveller?.email ?? fallbackEmail,
      tripName: b.trip_name ?? b.trip?.name ?? null,
      segments,
    });
  }
  return bookings;
}
