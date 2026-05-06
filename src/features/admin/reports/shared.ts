import { resolveProfileName } from '@/lib/fullName';
import { flatJoin, type Joined } from '@/lib/supabase';

/**
 * Pieces shared by every report. Most reports deal with a "traveler"
 * shape — the user row plus their employee/guest names plus their
 * sponsor's name (when applicable) plus their inbound flight. Keeping
 * the join shape and resolution helpers in one place means a schema
 * tweak (a new column on `employee_profiles`, a new flight direction)
 * lands in one file instead of seven.
 */

export interface NameProfile {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  legal_name: string | null;
}

export interface FlightLeg {
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

export interface TravelerJoin {
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

export interface TravelerFields {
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
export function resolveTraveler(user: TravelerJoin | null): TravelerFields {
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

/**
 * The select fragment used everywhere we need a traveler shape. Putting
 * it in one place keeps the column list aligned with `TravelerJoin`.
 */
export const TRAVELER_USER_SELECT = `
  email, role,
  employee_profiles ( first_name, last_name, preferred_name, legal_name ),
  guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name ),
  sponsor:users!users_sponsor_id_fkey (
    email,
    employee_profiles ( first_name, last_name, preferred_name, legal_name )
  ),
  flights ( direction, arrival_at, flight_number )
`;
