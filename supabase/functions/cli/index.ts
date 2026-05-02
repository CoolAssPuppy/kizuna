import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient, getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

interface CliRequest {
  command?: string;
  format?: 'json' | 'md';
}

interface Caller {
  userId: string;
  email: string;
  role: string;
  apiKeyId: string | null;
  scope: 'read' | 'write' | 'admin';
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: { code: 'not_found', message: 'POST only' } }, { status: 405 });
  }

  const requestId = crypto.randomUUID();
  const started = performance.now();
  const authHeader = req.headers.get('Authorization');
  const auth = await authenticate(authHeader, req.headers.get('x-forwarded-for'));
  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'unauthorized', message: 'Unauthorized' }, request_id: requestId },
      { status: 401 },
    );
  }

  let body: CliRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'parse_error', message: 'Invalid JSON body' }, request_id: requestId },
      { status: 400 },
    );
  }

  const command = body.command?.trim();
  if (!command) {
    return jsonResponse(
      { ok: false, error: { code: 'parse_error', message: 'Missing command' }, request_id: requestId },
      { status: 400 },
    );
  }

  const result = await runReadOnlyCommand(command, body.format ?? 'json', auth);
  const durationMs = Math.round(performance.now() - started);
  console.log(JSON.stringify({ request_id: requestId, command, duration_ms: durationMs, outcome: result.ok ? 'ok' : 'error' }));

  return jsonResponse({ ...result, request_id: requestId });
});

async function authenticate(authHeader: string | null, ip: string | null): Promise<Caller | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const admin = getAdminClient();
  if (token.startsWith('kzn_')) {
    const { data, error } = await admin
      .rpc('verify_api_key', { p_token: token, ...(ip ? { p_ip: ip } : {}) })
      .maybeSingle();
    if (error || !data) return null;
    const { data: user } = await admin
      .from('users')
      .select('email, role')
      .eq('id', data.user_id)
      .maybeSingle();
    if (!user) return null;
    return {
      userId: data.user_id,
      email: user.email,
      role: user.role,
      apiKeyId: data.api_key_id,
      scope: data.scope,
    };
  }

  const userClient = getUserClient(authHeader);
  const caller = await getCallerUser(userClient, authHeader);
  if (!caller) return null;
  const { data: user } = await userClient
    .from('users')
    .select('email, role')
    .eq('id', caller.id)
    .maybeSingle();
  if (!user) return null;
  return {
    userId: caller.id,
    email: user.email,
    role: user.role,
    apiKeyId: null,
    scope: user.role === 'admin' || user.role === 'super_admin' ? 'admin' : 'write',
  };
}

async function runReadOnlyCommand(command: string, format: 'json' | 'md', caller: Caller) {
  const admin = getAdminClient();
  const words = command.split(/\s+/);
  const [verb, noun] = words;

  if (verb === 'help') {
    return ok(
      {
        commands: [
          'help',
          'schema',
          'me',
          'me itinerary',
          'events',
          'event',
          'sessions',
          'agenda',
        ],
      },
      format,
    );
  }

  if (verb === 'schema') {
    return ok({ commands: ['help', 'schema', 'me', 'me itinerary', 'events', 'event', 'sessions', 'agenda'] }, format);
  }

  if (verb === 'me' && !noun) {
    return ok({ userId: caller.userId, email: caller.email, role: caller.role }, format);
  }

  const { data: event } = await admin
    .from('events')
    .select('*')
    .eq('is_active', true)
    .eq('type', 'supafest')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!event) {
    return { ok: false, error: { code: 'not_found', message: 'No active event' } };
  }

  if (verb === 'me' && noun === 'itinerary') {
    const { data, error } = await admin
      .from('itinerary_items')
      .select('id,item_type,title,starts_at,ends_at,subtitle,source,source_id')
      .eq('user_id', caller.userId)
      .eq('event_id', event.id)
      .order('starts_at', { ascending: true });
    if (error) return { ok: false, error: { code: 'internal', message: error.message } };
    return ok({ eventId: event.id, items: data ?? [], generatedAt: new Date().toISOString() }, format);
  }

  if (verb === 'events') {
    const { data, error } = await admin
      .from('events')
      .select('id,name,start_date,end_date,location,is_active')
      .order('start_date');
    if (error) return { ok: false, error: { code: 'internal', message: error.message } };
    return ok({ events: data ?? [] }, format);
  }

  if (verb === 'event') {
    return ok({ event }, format);
  }

  if (verb === 'sessions' || verb === 'agenda') {
    const { data, error } = await admin
      .from('sessions')
      .select('id,title,starts_at,ends_at,location,is_mandatory,capacity')
      .eq('event_id', event.id)
      .order('starts_at');
    if (error) return { ok: false, error: { code: 'internal', message: error.message } };
    return ok({ sessions: data ?? [] }, format);
  }

  return { ok: false, error: { code: 'not_found', message: 'Command not found' } };
}

function ok(data: unknown, format: 'json' | 'md') {
  if (format === 'md') {
    return { ok: true, format, data, markdown: ['```json', JSON.stringify(data, null, 2), '```'].join('\n') };
  }
  return { ok: true, format, data };
}
