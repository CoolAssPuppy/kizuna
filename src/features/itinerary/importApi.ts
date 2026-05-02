import { getSupabaseClient } from '@/lib/supabase';
import {
  EMPTY_PARSED_ITINERARY,
  type ParsedCarService,
  type ParsedFlight,
  type ParsedHotel,
  type ParsedItinerary,
  type ParsedRentalCar,
} from '@/lib/integrations/openai';

import { timezoneForAirport } from './airportTimezones';

interface MaybeFunctionsHttpError {
  context?: { status?: number; body?: unknown };
}

function isNotDeployed(error: unknown): boolean {
  return (error as MaybeFunctionsHttpError | null)?.context?.status === 404;
}

/**
 * Pulls the function's JSON body out of the FunctionsHttpError so the
 * dialog can render the underlying reason ("unauthorized",
 * "OPENAI_API_KEY missing", etc.) instead of the generic
 * "Edge Function returned a non-2xx status code".
 */
async function describeFunctionError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response | { status?: number } } | null)?.context;
  if (ctx instanceof Response) {
    const text = await ctx.clone().text().catch(() => '');
    return new Error(`${ctx.status}: ${text || ctx.statusText}`);
  }
  if (error instanceof Error) return error;
  return new Error(String(error));
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
    if (isNotDeployed(response.error)) return { ...EMPTY_PARSED_ITINERARY };
    throw await describeFunctionError(response.error);
  }

  const data: ParsedItinerary | null = response.data;
  return {
    flights: data?.flights ?? [],
    hotels: data?.hotels ?? [],
    rental_cars: data?.rental_cars ?? [],
    car_services: data?.car_services ?? [],
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
      (
        f,
      ): f is ParsedFlight & {
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

interface ActiveEventLite {
  id: string;
  time_zone: string;
}

async function loadActiveEvent(): Promise<ActiveEventLite | null> {
  const { data, error } = await getSupabaseClient()
    .from('events')
    .select('id, time_zone')
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function dateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length === 10 ? `${trimmed}T00:00:00` : trimmed;
}

/**
 * Persist parsed hotels as user-owned itinerary_items of type
 * 'accommodation'. RLS allows the insert when source='self_imported' and
 * source_id IS NULL — those rows can't collide with the trigger-
 * materialised admin rows. Returns the number of rows inserted.
 */
export async function saveParsedAccommodations(
  userId: string,
  hotels: ReadonlyArray<ParsedHotel>,
): Promise<number> {
  if (hotels.length === 0) return 0;
  const event = await loadActiveEvent();
  if (!event) return 0;

  const rows = hotels
    .map((h) => {
      const startsAt = dateToIso(h.check_in_time_local);
      const endsAt = dateToIso(h.check_out_time_local);
      const title = h.lodging_name?.trim();
      if (!title || !startsAt) return null;
      return {
        user_id: userId,
        event_id: event.id,
        item_type: 'accommodation' as const,
        source: 'self_imported' as const,
        source_id: null,
        title,
        subtitle: h.address ?? h.city ?? null,
        starts_at: startsAt,
        starts_tz: event.time_zone,
        ends_at: endsAt,
        ends_tz: endsAt ? event.time_zone : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return 0;
  const { error } = await getSupabaseClient().from('itinerary_items').insert(rows);
  if (error) throw error;
  return rows.length;
}

/**
 * Persist parsed car services and rental cars as user-owned
 * itinerary_items of type 'transport'. Both shapes carry pickup time +
 * pickup/dropoff locations; we treat them uniformly. Rows missing
 * pickup time are skipped.
 */
export async function saveParsedTransfers(
  userId: string,
  carServices: ReadonlyArray<ParsedCarService>,
  rentalCars: ReadonlyArray<ParsedRentalCar>,
  eventTimezoneFallback: string,
): Promise<number> {
  if (carServices.length === 0 && rentalCars.length === 0) return 0;
  const event = await loadActiveEvent();
  if (!event) return 0;
  const tz = event.time_zone ?? eventTimezoneFallback;

  const transferRows = carServices
    .map((c) => {
      const startsAt = dateToIso(c.pickup_time_local);
      if (!startsAt) return null;
      const title = c.provider?.trim() || 'Car service';
      const subtitle = [c.pickup_location, c.dropoff_location].filter(Boolean).join(' → ') || null;
      const endsAt = dateToIso(c.dropoff_time_local);
      return {
        user_id: userId,
        event_id: event.id,
        item_type: 'transport' as const,
        source: 'self_imported' as const,
        source_id: null,
        title,
        subtitle,
        starts_at: startsAt,
        starts_tz: tz,
        ends_at: endsAt,
        ends_tz: endsAt ? tz : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const rentalRows = rentalCars
    .map((r) => {
      const startsAt = dateToIso(r.pickup_time_local);
      if (!startsAt) return null;
      const title = [r.company, r.car_description].filter(Boolean).join(' — ') || 'Rental car';
      const subtitle = [r.pickup_location, r.dropoff_location].filter(Boolean).join(' → ') || null;
      const endsAt = dateToIso(r.dropoff_time_local);
      return {
        user_id: userId,
        event_id: event.id,
        item_type: 'transport' as const,
        source: 'self_imported' as const,
        source_id: null,
        title,
        subtitle,
        starts_at: startsAt,
        starts_tz: tz,
        ends_at: endsAt,
        ends_tz: endsAt ? tz : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const rows = [...transferRows, ...rentalRows];
  if (rows.length === 0) return 0;
  const { error } = await getSupabaseClient().from('itinerary_items').insert(rows);
  if (error) throw error;
  return rows.length;
}
