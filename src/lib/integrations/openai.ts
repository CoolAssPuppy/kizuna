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
  airline: string | null;
  airline_iata: string | null;
  flight_number: string | null;
  confirmation_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_time_local: string | null;
  arrival_time_local: string | null;
  seat_number: string | null;
  cabin_class: string | null;
}

export interface ParsedAccommodation {
  property_name: string | null;
  address: string | null;
  city: string | null;
  check_in_local: string | null;
  check_out_local: string | null;
  confirmation_number: string | null;
  notes: string | null;
}

export interface ParsedTransfer {
  provider: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time_local: string | null;
  notes: string | null;
}

export interface ParsedItinerary {
  flights: ParsedFlight[];
  accommodations: ParsedAccommodation[];
  transfers: ParsedTransfer[];
}

export const EMPTY_PARSED_ITINERARY: ParsedItinerary = {
  flights: [],
  accommodations: [],
  transfers: [],
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
 * The prompt that turns an arbitrary chunk of text (forwarded confirmation
 * email, copy-pasted itinerary, OCR'd PDF) into a JSON ParsedItinerary.
 *
 * Kept narrow on purpose: Supafest only needs flights, accommodations, and
 * shuttle transfers. No restaurants, activities, or rental cars.
 */
export const ITINERARY_PARSER_PROMPT = `You are a travel itinerary parser for Supafest, a corporate offsite in Banff, Canada. Extract structured trip data from raw, unstructured text. The text may be a forwarded confirmation email, a copy-pasted PDF, or a screenshot OCR'd to text.

Return a single JSON object matching this schema, with no prose before or after:

{
  "flights": [
    {
      "airline": "Common name, e.g. Air Canada",
      "airline_iata": "Two-letter IATA, e.g. AC",
      "flight_number": "Numeric only, e.g. 142",
      "confirmation_number": "PNR or booking reference",
      "departure_airport": "Three-letter IATA, e.g. SFO",
      "arrival_airport": "Three-letter IATA, e.g. YYC",
      "departure_time_local": "ISO 8601 in local time, e.g. 2027-04-12T08:30:00",
      "arrival_time_local": "ISO 8601 in local time",
      "seat_number": "e.g. 12A",
      "cabin_class": "Economy | Premium | Business | First"
    }
  ],
  "accommodations": [
    {
      "property_name": "e.g. Banff Springs Hotel",
      "address": "Full street address",
      "city": "e.g. Banff",
      "check_in_local": "ISO 8601 local time",
      "check_out_local": "ISO 8601 local time",
      "confirmation_number": "Booking reference",
      "notes": "Free-form notes"
    }
  ],
  "transfers": [
    {
      "provider": "e.g. Brewster, Banff Airporter",
      "pickup_location": "e.g. YYC Airport Terminal 1",
      "dropoff_location": "e.g. Banff Springs",
      "pickup_time_local": "ISO 8601 local time",
      "notes": "Free-form notes"
    }
  ]
}

Rules:
- Times stay in the LOCAL timezone of where the event happens. Do not convert to UTC.
- If a field is missing in the source text, use null.
- If no records of a category are present, return an empty array.
- Always return all three top-level keys, even when empty.
- Use IATA codes for airports and airlines, sentence case for property names.`;

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
    accommodations: parsed.accommodations ?? [],
    transfers: parsed.transfers ?? [],
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
