// Itinerary parser shared between the parse-itinerary edge function and
// any future agent that needs the same structured output.
//
// Kept in sync with src/lib/integrations/openai.ts. If you change the
// schema or prompt there, mirror the change here. The two files cannot
// import each other (Deno vs node) but the surface area is small enough
// that a quick eyeball passes the audit.

declare const Deno: { env: { get: (key: string) => string | undefined } };

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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export const ITINERARY_PARSER_PROMPT = `You are a travel itinerary parser for Supafest, a corporate offsite in Banff, Canada. Extract structured trip data from raw, unstructured text. The text may be a forwarded confirmation email, a copy-pasted PDF, or a screenshot OCR'd to text.

Return a single JSON object matching this schema, with no prose before or after:

{
  "flights": [
    { "airline": "", "airline_iata": "", "flight_number": "", "confirmation_number": "",
      "departure_airport": "", "arrival_airport": "", "departure_time_local": "",
      "arrival_time_local": "", "seat_number": "", "cabin_class": "" }
  ],
  "accommodations": [
    { "property_name": "", "address": "", "city": "", "check_in_local": "",
      "check_out_local": "", "confirmation_number": "", "notes": "" }
  ],
  "transfers": [
    { "provider": "", "pickup_location": "", "dropoff_location": "",
      "pickup_time_local": "", "notes": "" }
  ]
}

Rules:
- Times stay in the LOCAL timezone of where the event happens. Do not convert to UTC.
- ISO 8601 format (YYYY-MM-DDTHH:mm:ss) without timezone suffix.
- Use IATA airport codes (3 letters) and IATA airline codes (2 letters).
- If a field is missing, use null. If a category is empty, use [].
- Always return all three top-level keys.`;

export async function parseItineraryWithOpenAI(text: string): Promise<ParsedItinerary> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.warn('[parse-itinerary] OPENAI_API_KEY missing — returning empty itinerary');
    return { ...EMPTY_PARSED_ITINERARY };
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? DEFAULT_MODEL,
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
