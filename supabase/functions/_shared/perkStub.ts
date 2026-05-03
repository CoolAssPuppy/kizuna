// Shared Perk (TravelPerk) stub directory.
//
// One source of truth for the deterministic fixture data the SPA
// (src/lib/integrations/perk.ts) and the edge function
// (sync-perk) all return when no real PERK_API_KEY is configured.
//
// Modeled after `_shared/hibobStub.ts`. Keep this file aligned with
// the seeded Supafest 2027 dates in
// `supabase/events/2027-supafest.sql` so a stub-mode itinerary lands
// on the right calendar week.
//
// Field shape mirrors the subset of the TravelPerk Booking API that
// `_shared/perkClient.ts` consumes. The real API returns much more —
// only what we map onto `public.flights` is captured here.

export interface PerkFlightSegment {
  /** IATA airport code, e.g. 'SFO'. */
  origin: string;
  /** IATA airport code, e.g. 'YYC'. */
  destination: string;
  /** ISO 8601 local-time string, e.g. '2027-01-08T07:45:00'. */
  departureLocal: string;
  /** IANA tz of `origin`, e.g. 'America/Los_Angeles'. */
  departureTz: string;
  /** ISO 8601 local-time string, e.g. '2027-01-08T11:42:00'. */
  arrivalLocal: string;
  /** IANA tz of `destination`. */
  arrivalTz: string;
  /** Marketing carrier name, e.g. 'American Airlines'. */
  airline: string;
  /** Carrier code + flight number, e.g. 'AA228'. */
  flightNumber: string;
  /** Optional confirmation / record locator. */
  confirmationCode: string | null;
}

export interface PerkBooking {
  /** TravelPerk booking id (stable across PNR changes). Becomes `flights.perk_booking_ref`. */
  bookingId: string;
  /** Email of the traveller — keys the lookup against auth.users. */
  travellerEmail: string;
  /** Human-friendly trip name TravelPerk surfaces (e.g. "Supafest 2027"). */
  tripName: string | null;
  /** One booking can wrap an outbound + return; we model both in segments. */
  segments: ReadonlyArray<PerkFlightSegment>;
}

/**
 * Stub directory keyed by lowercase traveller email. Each employee has
 * a Supafest booking plus a separate unrelated business trip so the
 * "Sync with Perk" tab can render a real list with multiple choices.
 *
 * Outbound dates land on Friday Jan 8, 2027 → return Sunday Jan 17,
 * 2027 to match the canonical Supafest 2027 window.
 */
export const PERK_STUB: ReadonlyArray<PerkBooking> = [
  {
    bookingId: 'tp_PAUL_supafest',
    travellerEmail: 'paul@kizuna.dev',
    tripName: 'Supafest 2027',
    segments: [
      {
        origin: 'LHR',
        destination: 'YYC',
        departureLocal: '2027-01-08T11:30:00',
        departureTz: 'Europe/London',
        arrivalLocal: '2027-01-08T13:55:00',
        arrivalTz: 'America/Edmonton',
        airline: 'Air Canada',
        flightNumber: 'AC855',
        confirmationCode: 'X4PR2L',
      },
      {
        origin: 'YYC',
        destination: 'LHR',
        departureLocal: '2027-01-17T18:30:00',
        departureTz: 'America/Edmonton',
        arrivalLocal: '2027-01-18T10:50:00',
        arrivalTz: 'Europe/London',
        airline: 'Air Canada',
        flightNumber: 'AC854',
        confirmationCode: 'X4PR2L',
      },
    ],
  },
  {
    bookingId: 'tp_PAUL_berlin_summit',
    travellerEmail: 'paul@kizuna.dev',
    tripName: 'Berlin database summit',
    segments: [
      {
        origin: 'LHR',
        destination: 'BER',
        departureLocal: '2027-03-04T07:15:00',
        departureTz: 'Europe/London',
        arrivalLocal: '2027-03-04T10:05:00',
        arrivalTz: 'Europe/Berlin',
        airline: 'British Airways',
        flightNumber: 'BA982',
        confirmationCode: 'BR1NDB',
      },
      {
        origin: 'BER',
        destination: 'LHR',
        departureLocal: '2027-03-06T16:40:00',
        departureTz: 'Europe/Berlin',
        arrivalLocal: '2027-03-06T17:35:00',
        arrivalTz: 'Europe/London',
        airline: 'British Airways',
        flightNumber: 'BA987',
        confirmationCode: 'BR1NDB',
      },
    ],
  },
  {
    bookingId: 'tp_MAYA_supafest',
    travellerEmail: 'maya@kizuna.dev',
    tripName: 'Supafest 2027',
    segments: [
      {
        origin: 'JFK',
        destination: 'YYC',
        departureLocal: '2027-01-08T08:15:00',
        departureTz: 'America/New_York',
        arrivalLocal: '2027-01-08T11:48:00',
        arrivalTz: 'America/Edmonton',
        airline: 'Delta',
        flightNumber: 'DL1042',
        confirmationCode: 'M2K9QJ',
      },
      {
        origin: 'YYC',
        destination: 'JFK',
        departureLocal: '2027-01-17T16:05:00',
        departureTz: 'America/Edmonton',
        arrivalLocal: '2027-01-17T22:25:00',
        arrivalTz: 'America/New_York',
        airline: 'Delta',
        flightNumber: 'DL1043',
        confirmationCode: 'M2K9QJ',
      },
    ],
  },
  {
    bookingId: 'tp_MAYA_sf_offsite',
    travellerEmail: 'maya@kizuna.dev',
    tripName: 'San Francisco team offsite',
    segments: [
      {
        origin: 'JFK',
        destination: 'SFO',
        departureLocal: '2027-02-11T07:00:00',
        departureTz: 'America/New_York',
        arrivalLocal: '2027-02-11T10:32:00',
        arrivalTz: 'America/Los_Angeles',
        airline: 'JetBlue',
        flightNumber: 'B6915',
        confirmationCode: 'JB7WQF',
      },
      {
        origin: 'SFO',
        destination: 'JFK',
        departureLocal: '2027-02-13T22:10:00',
        departureTz: 'America/Los_Angeles',
        arrivalLocal: '2027-02-14T06:38:00',
        arrivalTz: 'America/New_York',
        airline: 'JetBlue',
        flightNumber: 'B6920',
        confirmationCode: 'JB7WQF',
      },
    ],
  },
  {
    bookingId: 'tp_LU_supafest',
    travellerEmail: 'lu@kizuna.dev',
    tripName: 'Supafest 2027',
    segments: [
      {
        origin: 'YYZ',
        destination: 'YYC',
        departureLocal: '2027-01-08T10:00:00',
        departureTz: 'America/Toronto',
        arrivalLocal: '2027-01-08T12:35:00',
        arrivalTz: 'America/Edmonton',
        airline: 'WestJet',
        flightNumber: 'WS672',
        confirmationCode: 'L4U8AB',
      },
      {
        origin: 'YYC',
        destination: 'YYZ',
        departureLocal: '2027-01-17T15:20:00',
        departureTz: 'America/Edmonton',
        arrivalLocal: '2027-01-17T20:55:00',
        arrivalTz: 'America/Toronto',
        airline: 'WestJet',
        flightNumber: 'WS673',
        confirmationCode: 'L4U8AB',
      },
    ],
  },
  {
    bookingId: 'tp_LU_vancouver_recce',
    travellerEmail: 'lu@kizuna.dev',
    tripName: 'Vancouver venue recce',
    segments: [
      {
        origin: 'YYZ',
        destination: 'YVR',
        departureLocal: '2027-04-22T08:00:00',
        departureTz: 'America/Toronto',
        arrivalLocal: '2027-04-22T10:25:00',
        arrivalTz: 'America/Vancouver',
        airline: 'Air Canada',
        flightNumber: 'AC189',
        confirmationCode: 'V4NR3C',
      },
    ],
  },
];

/**
 * Index from lowercase traveller email to every booking on file. The
 * list-mode call returns this array directly; the import-mode call
 * picks one entry by booking id.
 */
export const PERK_STUB_BY_EMAIL: ReadonlyMap<string, ReadonlyArray<PerkBooking>> = (() => {
  const map = new Map<string, PerkBooking[]>();
  for (const booking of PERK_STUB) {
    const key = booking.travellerEmail.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.push(booking);
    } else {
      map.set(key, [booking]);
    }
  }
  return map;
})();

export const PERK_STUB_BY_BOOKING_ID: ReadonlyMap<string, PerkBooking> = new Map(
  PERK_STUB.map((b) => [b.bookingId, b]),
);
