// parse-itinerary edge function
//
// Accepts raw itinerary text from the SPA, runs it through OpenAI to
// extract a structured ParsedItinerary, and returns the JSON.
//
// The SPA never sees OPENAI_API_KEY. When the key is missing on this
// runtime, the parser returns an empty result so local dev still works.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { parseItineraryWithOpenAI } from '../_shared/itineraryParser.ts';

declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return jsonResponse({ error: 'Missing text field' }, { status: 400 });
  }

  try {
    const result = await parseItineraryWithOpenAI(text);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[parse-itinerary]', message);
    return jsonResponse({ error: message }, { status: 502 });
  }
});
