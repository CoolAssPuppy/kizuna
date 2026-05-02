// Kizuna CLI HTTP surface. Authenticates a PAT or a session JWT,
// constructs a per-request Supabase client whose Authorization header
// carries the user's identity, and runs the requested command through
// the shared dispatcher. RLS gates every query — the edge function
// never queries application data with the service role.
//
// Deno resolves the registry by following relative TS imports rooted
// at src/lib/cli/. supabase/functions/deno.json maps `zod` and
// `@supabase/supabase-js` to esm.sh URLs so the same source compiles
// for both Vite and Deno.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { mintUserToken } from '../_shared/cliJwt.ts';
import { dispatch, type CommandFormat, type CommandResult } from '../../../src/lib/cli/index.ts';
import type { CliPatScope, CliTranslate } from '../../../src/lib/cli/context.ts';
import type { Database } from '../../../src/types/database.types.ts';

declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

interface CliRequest {
  command?: string;
  format?: CommandFormat;
}

type AppRole = 'employee' | 'guest' | 'admin' | 'super_admin' | 'dependent';

interface AuthenticatedCaller {
  userId: string;
  email: string;
  role: AppRole;
  apiKeyId: string | null;
  patScope: CliPatScope | null;
  /** Authorization header to pass to Supabase. PAT path mints a fresh JWT; session path reuses the original. */
  authHeader: string;
}

const stubT: CliTranslate = (key) => key;

export const handler = async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('not_found', 'POST only', crypto.randomUUID(), 405);
  }

  const requestId = crypto.randomUUID();
  const started = performance.now();
  const ip = req.headers.get('x-forwarded-for');

  let body: CliRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse('parse_error', 'Invalid JSON body', requestId, 400);
  }

  const command = body.command?.trim();
  if (!command) {
    return errorResponse('parse_error', 'Missing command', requestId, 400);
  }

  const auth = await authenticate(req.headers.get('Authorization'), ip);
  if (!auth) return errorResponse('unauthorized', 'Unauthorized', requestId, 401);

  const supabase = scopedClient(auth.authHeader);
  const result = await dispatch(
    { raw: command, ...(body.format ? { format: body.format } : {}) },
    {
      supabase,
      user: { id: auth.userId, email: auth.email, role: auth.role },
      role: auth.role === 'admin' || auth.role === 'super_admin' ? auth.role : 'attendee',
      patScope: auth.patScope,
      t: stubT,
      signal: req.signal,
    },
  );

  const durationMs = Math.round(performance.now() - started);
  await writeAuditLog(auth, requestId, command, result, durationMs);
  console.info(
    JSON.stringify({
      request_id: requestId,
      command,
      duration_ms: durationMs,
      outcome: result.ok ? 'ok' : 'error',
      error_code: !result.ok ? result.error.code : undefined,
    }),
  );

  return jsonResponse(
    { ...result, request_id: requestId },
    { status: httpStatusFor(result), headers: corsHeaders },
  );
};

Deno.serve(handler);

function httpStatusFor(result: CommandResult): number {
  if (result.ok) return 200;
  switch (result.error.code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'parse_error':
    case 'validation_error':
      return 400;
    case 'rate_limit':
      return 429;
    default:
      return 500;
  }
}

function errorResponse(code: string, message: string, requestId: string, status: number): Response {
  return jsonResponse(
    { ok: false, error: { code, message }, request_id: requestId },
    { status, headers: corsHeaders },
  );
}

async function authenticate(
  authHeader: string | null,
  ip: string | null,
): Promise<AuthenticatedCaller | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token || !authHeader) return null;
  return token.startsWith('kzn_') ? authenticatePat(token, ip) : authenticateSessionJwt(authHeader);
}

async function authenticatePat(
  token: string,
  ip: string | null,
): Promise<AuthenticatedCaller | null> {
  const admin = adminClient();
  const verifyArgs: { p_token: string; p_ip?: string } = { p_token: token };
  if (ip) verifyArgs.p_ip = ip;
  const { data, error } = await admin.rpc('verify_api_key', verifyArgs).maybeSingle();
  if (error || !data) return null;

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('email, role')
    .eq('id', data.user_id)
    .maybeSingle();
  if (userError || !userRow) return null;

  const minted = await mintUserToken({
    userId: data.user_id,
    appRole: userRow.role,
    email: userRow.email,
  });

  return {
    userId: data.user_id,
    email: userRow.email,
    role: userRow.role as AppRole,
    apiKeyId: data.api_key_id,
    patScope: data.scope as CliPatScope,
    authHeader: `Bearer ${minted.token}`,
  };
}

async function authenticateSessionJwt(authHeader: string): Promise<AuthenticatedCaller | null> {
  const userClient = scopedClient(authHeader);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  const { data: row, error: rowError } = await userClient
    .from('users')
    .select('email, role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (rowError || !row) return null;
  return {
    userId: data.user.id,
    email: row.email,
    role: row.role as AppRole,
    apiKeyId: null,
    patScope: null,
    authHeader,
  };
}

function adminClient(): SupabaseClient<Database> {
  const url = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'SB_SECRET_KEY');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function scopedClient(authHeader: string): SupabaseClient<Database> {
  const url = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anon = requireEnv(
    'SUPABASE_ANON_KEY',
    'SB_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  );
  return createClient<Database>(url, anon, {
    global: { headers: { Authorization: authHeader } },
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

async function writeAuditLog(
  auth: AuthenticatedCaller,
  requestId: string,
  command: string,
  result: CommandResult,
  durationMs: number,
): Promise<void> {
  // Reads are not audited (RLS already gates them and the volume is
  // noise). Errors are always logged so abuse and broken integrations
  // surface. Mutation logging will land with M5 once write commands
  // exist; this stub guarantees the wiring is exercised today.
  const isError = !result.ok;
  if (!isError) return;
  try {
    await adminClient().rpc('write_cli_audit_log', {
      p_user_id: auth.userId,
      p_api_key_id: auth.apiKeyId,
      p_request_id: requestId,
      p_command: command,
      p_scope: auth.patScope ?? 'admin',
      p_outcome: 'error',
      p_error_code: result.error.code,
      p_duration_ms: durationMs,
    });
  } catch (err) {
    console.warn('cli_audit_log write failed', err);
  }
}
