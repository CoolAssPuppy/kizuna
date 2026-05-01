/**
 * OpenAI wrapper.
 *
 * The SPA does NOT call OpenAI directly — that would expose the API key.
 * Itinerary parsing happens inside the `parse-itinerary` edge function.
 * This module exists to:
 *   1. Share the parser prompt with the edge function (single source of truth)
 *   2. Share the parsed-itinerary TypeScript types with the SPA
 *   3. Provide a graceful stub used by tests and by the edge function when
 *      OPENAI_API_KEY is missing in local dev
 *
 * The stub returns an empty `ParsedItinerary`. Callers should still
 * proceed without throwing — the user can always edit the result by hand.
 */

import type { IntegrationStatus } from './types';

export interface ParsedFlight {
  confirmation_number: string | null;
  airline: string | null;
  airline_icao: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_time_local: string | null;
  arrival_time_local: string | null;
  seat_class: string | null;
  seat_number: string | null;
  status: string | null;
  terminal_departure: string | null;
  terminal_arrival: string | null;
}

export interface ParsedHotel {
  confirmation_number: string | null;
  lodging_name: string | null;
  city: string | null;
  address: string | null;
  room_description: string | null;
  refundable: boolean | null;
  breakfast_included: boolean | null;
  check_in_time_local: string | null;
  check_in_rules: string | null;
  check_out_time_local: string | null;
  check_out_rules: string | null;
  total_cost: number | null;
  currency: string | null;
  phone: string | null;
  notes: string | null;
}

export interface ParsedRentalCar {
  confirmation_number: string | null;
  agency_name: string | null;
  city: string | null;
  agency_address: string | null;
  car_description: string | null;
  price: number | null;
  currency: string | null;
  company: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time_local: string | null;
  dropoff_time_local: string | null;
  car_type: string | null;
}

export interface ParsedCarService {
  confirmation_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  meeting_instructions: string | null;
  price: number | null;
  currency: string | null;
  provider: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time_local: string | null;
  dropoff_time_local: string | null;
  car_type: string | null;
}

export interface ParsedItinerary {
  flights: ParsedFlight[];
  hotels: ParsedHotel[];
  rental_cars: ParsedRentalCar[];
  car_services: ParsedCarService[];
}

export const EMPTY_PARSED_ITINERARY: ParsedItinerary = {
  flights: [],
  hotels: [],
  rental_cars: [],
  car_services: [],
};

interface DriverConfig {
  /** OpenAI API key. When absent we run in stubbed mode. */
  apiKey?: string | undefined;
  /** Override the global fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Override the model — defaults to gpt-4o-mini. */
  model?: string;
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Battle-tested itinerary parser prompt ported verbatim from the
 * tripmaster consumer app where it has been parsing real-world
 * confirmation emails for over a year. Captures flights, hotels,
 * rental_cars, car_services, points_of_interest, activities, rails,
 * cruises, and other_objects. Kizuna only persists the first four for
 * Phase 1 — the rest are kept in the schema so we never silently drop
 * fields and can light them up when sessions of those types matter.
 */
export const ITINERARY_PARSER_PROMPT = `You are a travel itinerary parser. Your job is to extract structured trip data from raw, unstructured text. The text may be copied from emails, PDFs, or forwarded messages and may contain multiple reservations. Parse it as thoroughly as possible.

Return a single JSON object with the following structure.

CRITICAL TIME HANDLING RULES:
- All timestamps must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss).
- PRESERVE times EXACTLY as they appear in the document. DO NOT convert to UTC.
- Flight times in itineraries are ALWAYS local to the departure/arrival airport.
- Hotel check-in/check-out times are local to the hotel location.
- Activity times are local to the activity location.
- The server will handle timezone conversion using airport/city lookups.
- If only a date is shown (no time), use 00:00:00 for the time component.

Other rules:
- If a field is missing, leave it as null or an empty string.
- Preserve formatting (e.g. multi-line notes or descriptions) wherever possible.
- Turn all airport names into IATA codes (e.g., "JFK", "LAX", "BKK", "LHR").
- Turn all airlines into ICAO codes for airline_icao (e.g., "UAL", "ETD", "VNA").
- All names should be reformatted into Sentence Case.
- Retain diacritics.

IMPORTANT: For flights, the "airline" field should contain the airline's common name (e.g., "Etihad Airways", "United Airlines", "Vietnam Airlines"), while the "airline_icao" field should contain the airline's official ICAO code (e.g., "ETD", "UAL", "HVN"). The "flight_number" field should contain just the numeric flight number (e.g., "288", "1234").

ACTIVITY TYPE CLASSIFICATION (CRITICAL - read carefully):
The "type" field for activities MUST be one of: "activity", "restaurant", or "tour".

Use "restaurant" when ANY of these apply:
- The venue name contains: restaurant, bistro, cafe, café, brasserie, trattoria, osteria, pizzeria, steakhouse, grill, diner, eatery, kitchen, tavern, pub (for dining), bar (for dining), lounge (for dining)
- The booking is from: OpenTable, Resy, TheFork, Yelp Reservations, Tock, SevenRooms, Yelp, Google reservation
- The text mentions: dinner reservation, lunch reservation, brunch, table for, party size, dining, seated, covers
- It's clearly a place where the primary purpose is eating a meal

Use "tour" when ANY of these apply:
- Booked through: Viator, GetYourGuide, Klook, Airbnb Experiences, TripAdvisor tours
- The text mentions: guided tour, walking tour, day trip, excursion, experience, workshop, class (cooking class, art class, etc.), boat tour, wine tasting with guide, museum tour, city tour, sightseeing

Use "activity" for everything else:
- Concerts, shows, theater, sports events, spa appointments, fitness classes, generic scheduled activities
- When in doubt between restaurant and activity, choose "restaurant" if food/dining is the primary purpose

Schema:
{
  "flights": [
    {
      "confirmation_number": "",
      "airline": "",
      "airline_icao": "",
      "flight_number": "",
      "departure_airport": "",
      "arrival_airport": "",
      "departure_time_local": "",
      "arrival_time_local": "",
      "seat_class": "",
      "seat_number": "",
      "status": "",
      "terminal_departure": "",
      "terminal_arrival": ""
    }
  ],
  "hotels": [
    {
      "confirmation_number": "",
      "lodging_name": "",
      "city": "",
      "address": "",
      "room_description": "",
      "refundable": false,
      "breakfast_included": false,
      "check_in_time_local": "",
      "check_in_rules": "",
      "check_out_time_local": "",
      "check_out_rules": "",
      "total_cost": null,
      "currency": "USD",
      "phone": "",
      "notes": ""
    }
  ],
  "rental_cars": [
    {
      "confirmation_number": "",
      "agency_name": "",
      "city": "",
      "agency_address": "",
      "car_description": "",
      "price": null,
      "currency": "USD",
      "company": "",
      "pickup_location": "",
      "dropoff_location": "",
      "pickup_time_local": "",
      "dropoff_time_local": "",
      "car_type": ""
    }
  ],
  "car_services": [
    {
      "confirmation_number": "",
      "driver_name": "",
      "driver_phone": "",
      "meeting_instructions": "",
      "price": null,
      "currency": "USD",
      "provider": "",
      "pickup_location": "",
      "dropoff_location": "",
      "pickup_time_local": "",
      "dropoff_time_local": "",
      "car_type": ""
    }
  ],
  "points_of_interest": [],
  "activities": [],
  "rails": [],
  "cruises": [],
  "other_objects": []
}

Only return the JSON. Do not include any extra text, explanation, or formatting.`;

export function openAIStatus(config: DriverConfig): IntegrationStatus {
  return config.apiKey ? { mode: 'live' } : { mode: 'stubbed', reason: 'OPENAI_API_KEY missing' };
}

async function parseLive(
  config: DriverConfig & { apiKey: string },
  text: string,
): Promise<ParsedItinerary> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const model = config.model ?? DEFAULT_MODEL;

  const response = await fetchImpl(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ITINERARY_PARSER_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI parse failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as Partial<ParsedItinerary>;
  return {
    flights: parsed.flights ?? [],
    hotels: parsed.hotels ?? [],
    rental_cars: parsed.rental_cars ?? [],
    car_services: parsed.car_services ?? [],
  };
}

let stubWarned = false;
function parseStubbed(): ParsedItinerary {
  if (!stubWarned) {
    stubWarned = true;
    console.warn(
      '[openai] OPENAI_API_KEY missing — itinerary parser is stubbed. Set the key in supabase/.env to enable live parsing.',
    );
  }
  return { ...EMPTY_PARSED_ITINERARY };
}

/**
 * Parse free-form itinerary text into structured records. Returns the
 * stub (empty) result when no API key is configured.
 */
export async function parseItineraryText(
  config: DriverConfig,
  text: string,
): Promise<ParsedItinerary> {
  if (!config.apiKey) return parseStubbed();
  return parseLive({ ...config, apiKey: config.apiKey }, text);
}
