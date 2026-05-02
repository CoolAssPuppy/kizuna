// CORS helper shared across edge functions. Functions run on a different
// origin than the SPA, so every endpoint needs to honour preflight.
//
// Allow-origin is `*` because every endpoint requires a Supabase JWT in
// the Authorization header (any random page can fetch but won't get past
// auth). We do NOT use cookies for auth, so a wide-open allow-origin
// doesn't expose anything beyond what an authenticated request would
// already see. Tightening to a single SPA origin is a hardening move
// for M10 once the production hostname is locked in. (TECH_DEBT_AUDIT
// F008)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}
