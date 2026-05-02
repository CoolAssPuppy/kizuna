// Parses raw itinerary text through OpenAI. Auth-gated and size-capped
// so anonymous callers can't burn tokens.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { parseItineraryWithOpenAI } from '../_shared/itineraryParser.ts';
import { getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const MAX_BODY_BYTES = 32 * 1024;

export const handler = async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  // Size cap runs BEFORE auth: a request that's already over the limit
  // shouldn't burn an auth lookup. Same shape in rephrase-icebreaker.
  const contentLength = Number(req.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'payload_too_large' }, { status: 413 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const userClient = getUserClient(authHeader);
  const caller = await getCallerUser(userClient, authHeader);
  if (!caller) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return jsonResponse({ error: 'invalid_json_body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return jsonResponse({ error: 'missing_text_field' }, { status: 400 });
  }

  try {
    const result = await parseItineraryWithOpenAI(text);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[parse-itinerary]', message);
    return jsonResponse({ error: message }, { status: 502 });
  }
};

Deno.serve(handler);
