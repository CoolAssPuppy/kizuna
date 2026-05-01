// parse-itinerary edge function
//
// Accepts raw itinerary text from the SPA, runs it through OpenAI to
// extract a structured ParsedItinerary, and returns the JSON.
//
// The SPA never sees OPENAI_API_KEY. When the key is missing on this
// runtime, the parser returns an empty result so local dev still works.
//
// Auth: caller must present a Supabase JWT — no anonymous traffic
// reaches OpenAI from here. (TECH_DEBT_AUDIT F001)
// Size cap: bodies above 32KB are rejected before any token is spent.
// (TECH_DEBT_AUDIT F007)

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { parseItineraryWithOpenAI } from '../_shared/itineraryParser.ts';
import { getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };

const MAX_BODY_BYTES = 32 * 1024;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const userClient = getUserClient(authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const contentLength = Number(req.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'payload_too_large' }, { status: 413 });
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
