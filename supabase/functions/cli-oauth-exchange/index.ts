// Trades a one-time OAuth code (minted by /cli/oauth-authorize) for a
// freshly issued Kizuna PAT. The browser does not see the PAT — only
// the local agent that started the OAuth flow does, because the
// callback page POSTs to the agent's loopback redirect, not to this
// endpoint.
//
// This endpoint is unauthenticated by design: the OAuth code itself
// is the auth, gated by `exchange_oauth_code` in Postgres which
// rejects expired, consumed, or state-mismatched codes.

import { createClient } from '@supabase/supabase-js';

import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';

declare const Deno: { env: { get: (k: string) => string | undefined } };

interface ExchangeRequest {
  code?: string;
  state?: string;
}

interface ExchangeResponseOk {
  ok: true;
  id: string;
  token: string;
  scope: 'read' | 'write' | 'admin';
}

interface ExchangeResponseError {
  ok: false;
  error: { code: string; message: string };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: { code: 'method_not_allowed', message: 'POST only' },
      } satisfies ExchangeResponseError,
      { status: 405, headers: corsHeaders },
    );
  }

  let body: ExchangeRequest;
  try {
    body = (await req.json()) as ExchangeRequest;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: { code: 'parse_error', message: 'Invalid JSON body' },
      } satisfies ExchangeResponseError,
      { status: 400, headers: corsHeaders },
    );
  }

  const code = body.code?.trim();
  const state = body.state?.trim();
  if (!code || !state) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'parse_error',
          message: 'Missing code or state',
        },
      } satisfies ExchangeResponseError,
      { status: 400, headers: corsHeaders },
    );
  }

  const admin = adminClient();
  const { data, error } = await admin
    .rpc('exchange_oauth_code', { p_code: code, p_state: state })
    .maybeSingle();

  if (error || !data) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'invalid_code',
          message: error?.message ?? 'Authorization code is invalid or expired.',
        },
      } satisfies ExchangeResponseError,
      { status: 400, headers: corsHeaders },
    );
  }

  // Resolve the scope from the prefix in the token. exchange_oauth_code
  // mints `kzn_<scope>_<random>`, so the second segment is the scope.
  const scope = inferScope(data.token);

  return jsonResponse(
    { ok: true, id: data.id, token: data.token, scope } satisfies ExchangeResponseOk,
    { status: 200, headers: corsHeaders },
  );
});

// Service-role client. Required because this function runs the OAuth
// authorization-code → PAT exchange: it must (1) atomically mark the
// pending oauth_codes row as consumed before another request can replay
// it, and (2) mint a row in api_keys for the user the code belongs to.
// The user's own JWT isn't sent on this transport (the CLI flow happens
// before the PAT exists), so we cannot use the anon-keyed userClient
// pattern here. Caller authentication is the signed authorization code
// itself, verified earlier in the request.
function adminClient() {
  const url = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'SB_SECRET_KEY');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireEnv(...candidates: string[]): string {
  for (const candidate of candidates) {
    const value = Deno.env.get(candidate);
    if (value) return value;
  }
  throw new Error(`Missing env var: ${candidates[0]}`);
}

function inferScope(token: string): 'read' | 'write' | 'admin' {
  const parts = token.split('_');
  const candidate = parts[1];
  if (candidate === 'read' || candidate === 'write' || candidate === 'admin') {
    return candidate;
  }
  return 'read';
}
