// Itinerary parser shared between the parse-itinerary edge function and
// any future Deno agent that needs the same structured output.
//
// Kept in sync with src/lib/integrations/openai.ts. Each runtime keeps
// its own copy because Deno cannot import from src/.

declare const Deno: { env: { get: (key: string) => string | undefined } };

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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

// Battle-tested prompt ported from consumer-apps/tripmaster.
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

export async function parseItineraryWithOpenAI(text: string): Promise<ParsedItinerary> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    // Hard error rather than the previous "return empty itinerary" so a
    // missing prod secret surfaces as a visible failure instead of
    // masquerading as "we couldn't find anything to import." Local devs
    // who need the stub fallback can set OPENAI_API_KEY=stub explicitly
    // and read the surfaced 401/403 from OpenAI rather than this branch.
    throw new Error(
      'OPENAI_API_KEY is not set on the parse-itinerary edge function. Run `supabase secrets set OPENAI_API_KEY=...` against the project.',
    );
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // `||` (not `??`) so OPENAI_MODEL="" in env still falls back.
      model: Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL,
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
  const rawContent = json.choices?.[0]?.message?.content ?? '{}';
  // Some models wrap JSON in markdown fences even with response_format set.
  // Strip ```json ... ``` defensively before parsing.
  const stripped = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');

  let parsed: Partial<ParsedItinerary>;
  try {
    parsed = JSON.parse(stripped) as Partial<ParsedItinerary>;
  } catch (error) {
    const head = stripped.slice(0, 240);
    throw new Error(
      `OpenAI returned non-JSON content (first 240 chars): ${head} — original: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    flights: nullifyEmptyStrings(parsed.flights ?? []),
    hotels: nullifyEmptyStrings(parsed.hotels ?? []),
    rental_cars: nullifyEmptyStrings(parsed.rental_cars ?? []),
    car_services: nullifyEmptyStrings(parsed.car_services ?? []),
  };
}

/**
 * Models occasionally return empty strings instead of null for missing
 * fields. Downstream filters then treat "" as truthy and try to persist
 * it, which trips schema CHECKs (e.g. departure_airport length=3).
 * Walk each row and coerce empty strings to null.
 */
function nullifyEmptyStrings<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const key of Object.keys(out)) {
      const value = out[key];
      if (typeof value === 'string' && value.trim() === '') out[key] = null;
    }
    return out as T;
  });
}
