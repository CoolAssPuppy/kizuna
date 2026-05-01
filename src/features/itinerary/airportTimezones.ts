/**
 * IATA airport code → IANA timezone mapping.
 *
 * Limited to airports likely to feed Supafest travel. The fallback is the
 * event timezone (America/Edmonton for Banff). When we add more events
 * we'll extend this list rather than ship a 9k-entry runtime dataset —
 * the Perk import path will fill in the long tail server-side.
 */
const AIRPORT_TZ: Readonly<Record<string, string>> = {
  // Western Canada (event proximity)
  YYC: 'America/Edmonton',
  YEG: 'America/Edmonton',
  YVR: 'America/Vancouver',
  YYZ: 'America/Toronto',
  YUL: 'America/Toronto',
  YOW: 'America/Toronto',
  YHZ: 'America/Halifax',

  // US west coast / hubs
  SFO: 'America/Los_Angeles',
  LAX: 'America/Los_Angeles',
  SEA: 'America/Los_Angeles',
  PDX: 'America/Los_Angeles',
  SAN: 'America/Los_Angeles',

  // US central / east
  DEN: 'America/Denver',
  PHX: 'America/Phoenix',
  ORD: 'America/Chicago',
  DFW: 'America/Chicago',
  ATL: 'America/New_York',
  JFK: 'America/New_York',
  LGA: 'America/New_York',
  EWR: 'America/New_York',
  BOS: 'America/New_York',
  IAD: 'America/New_York',

  // Europe
  LHR: 'Europe/London',
  CDG: 'Europe/Paris',
  AMS: 'Europe/Amsterdam',
  FRA: 'Europe/Berlin',
  MAD: 'Europe/Madrid',
  DUB: 'Europe/Dublin',

  // Asia Pacific
  NRT: 'Asia/Tokyo',
  HND: 'Asia/Tokyo',
  ICN: 'Asia/Seoul',
  SIN: 'Asia/Singapore',
  HKG: 'Asia/Hong_Kong',
  SYD: 'Australia/Sydney',
  AKL: 'Pacific/Auckland',

  // South America / Mexico
  GRU: 'America/Sao_Paulo',
  MEX: 'America/Mexico_City',
};

/** Look up the IANA timezone for an IATA code, with fallback. */
export function timezoneForAirport(iata: string | null | undefined, fallback: string): string {
  if (!iata) return fallback;
  return AIRPORT_TZ[iata.toUpperCase()] ?? fallback;
}
