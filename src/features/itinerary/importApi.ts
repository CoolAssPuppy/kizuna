import { getSupabaseClient } from '@/lib/supabase';
import {
  EMPTY_PARSED_ITINERARY,
  type ParsedFlight,
  type ParsedItinerary,
} from '@/lib/integrations/openai';

import { timezoneForAirport } from './airportTimezones';

interface MaybeFunctionsHttpError {
  context?: { status?: number };
}

function isNotDeployed(error: unknown): boolean {
  return (error as MaybeFunctionsHttpError | null)?.context?.status === 404;
}

/**
 * Send raw itinerary text to the parse-itinerary edge function. The edge
 * function holds OPENAI_API_KEY and calls the chat completions API; the
 * SPA never sees the key.
 *
 * If the edge function is not deployed yet (404 / network failure), we
 * return EMPTY_PARSED_ITINERARY so the UI can render the "nothing found"
 * empty state without throwing. Real failures bubble up.
 */
export async function parseItineraryViaEdge(text: string): Promise<ParsedItinerary> {
  const client = getSupabaseClient();
  const response = await client.functions.invoke<ParsedItinerary>('parse-itinerary', {
    body: { text },
  });

  if (response.error) {
    // FunctionsHttpError surfaces an HTTP code; treat 404 as "not deployed yet".
    if (isNotDeployed(response.error)) return { ...EMPTY_PARSED_ITINERARY };
    throw response.error;
  }

  const data: ParsedItinerary | null = response.data;
  return {
    flights: data?.flights ?? [],
    accommodations: data?.accommodations ?? [],
    transfers: data?.transfers ?? [],
  };
}

/**
 * Persist parsed flights into public.flights. Uses `manual_obs` as the
 * source so admin reports can distinguish self-reported flights from
 * Perk-synced ones. Returns the number of rows inserted.
 *
 * Skipped silently when the parsed flight is missing the minimum fields
 * needed for the flights table (origin, destination, both timestamps).
 */
export async function saveParsedFlights(
  userId: string,
  flights: ReadonlyArray<ParsedFlight>,
  /** Event timezone, used as the fallback when an airport isn't in our table. */
  eventTimezone: string,
): Promise<number> {
  const rows = flights
    .filter(
      (f): f is ParsedFlight & {
        departure_airport: string;
        arrival_airport: string;
        departure_time_local: string;
        arrival_time_local: string;
      } =>
        Boolean(
          f.departure_airport &&
            f.arrival_airport &&
            f.departure_time_local &&
            f.arrival_time_local,
        ),
    )
    .map((flight) => {
      const isInbound = flight.arrival_airport === 'YYC';
      const departureTz = timezoneForAirport(flight.departure_airport, eventTimezone);
      const arrivalTz = timezoneForAirport(flight.arrival_airport, eventTimezone);
      return {
        user_id: userId,
        direction: isInbound ? ('inbound' as const) : ('outbound' as const),
        origin: flight.departure_airport,
        destination: flight.arrival_airport,
        departure_at: flight.departure_time_local,
        departure_tz: departureTz,
        arrival_at: flight.arrival_time_local,
        arrival_tz: arrivalTz,
        airline: flight.airline,
        flight_number: flight.flight_number,
        source: 'manual_obs' as const,
        is_confirmed: false,
      };
    });

  if (rows.length === 0) return 0;

  const client = getSupabaseClient();
  const { error } = await client.from('flights').insert(rows);
  if (error) throw error;
  return rows.length;
}
