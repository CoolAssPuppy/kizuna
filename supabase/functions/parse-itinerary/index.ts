// Parses raw itinerary text through OpenAI. Auth-gated and size-capped
// so anonymous callers can't burn tokens.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { parseItineraryWithOpenAI } from '../_shared/itineraryParser.ts';
import { getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const MAX_BODY_BYTES = 32 * 1024;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('[parse-itinerary] no Authorization header');
    return jsonResponse({ error: 'unauthorized: missing Authorization header' }, { status: 401 });
  }
  const userClient = getUserClient(authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    console.error('[parse-itinerary] getUser failed', {
      message: userError?.message,
      status: userError?.status,
      supabaseUrl: Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? '(unset)',
    });
    return jsonResponse(
      { error: `unauthorized: ${userError?.message ?? 'getUser returned no user'}` },
      { status: 401 },
    );
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
