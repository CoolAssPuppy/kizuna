// CORS helper shared across edge functions. Functions run on a different
// origin than the SPA, so every endpoint needs to honour preflight.
//
// Allow-origin is read from KIZUNA_PUBLIC_URL when set (production /
// staging) and falls back to `*` only when unset (local dev). Bearer-
// JWT auth means a wider origin doesn't expose data, but tightening
// is defence-in-depth and matches Supabase best practice for hosted
// edge functions.
//
// Set KIZUNA_ALLOWED_ORIGINS as a comma-separated list when you need
// more than one origin (e.g. staging + the preview deploys for a PR).

const allowedOrigins = computeAllowedOrigins();

function computeAllowedOrigins(): readonly string[] {
  const explicit = Deno.env.get('KIZUNA_ALLOWED_ORIGINS');
  if (explicit) {
    return explicit
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const single = Deno.env.get('KIZUNA_PUBLIC_URL');
  if (single) return [single.replace(/\/$/, '')];
  return ['*'];
}

function originHeaderFor(req: Request): string {
  if (allowedOrigins.includes('*')) return '*';
  const requestOrigin = req.headers.get('Origin');
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
  // Fall back to the first allowed origin so the response is still well-
  // formed for non-browser callers (curl, server-to-server).
  return allowedOrigins[0] ?? '*';
}

export function corsHeadersFor(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': originHeaderFor(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

/**
 * Static fallback for callers that don't have the request handy. Used
 * by tests and by the `corsHeaders` re-export below for backwards
 * compatibility with call sites that don't thread `req` through.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigins[0] ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  Vary: 'Origin',
};

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }
  return null;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}, req?: Request): Response {
  const headers = req ? corsHeadersFor(req) : corsHeaders;
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}
