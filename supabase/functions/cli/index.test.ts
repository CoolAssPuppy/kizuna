// Edge-function contract tests. Run via `deno test supabase/functions`.
//
// These tests cover the gates that fire before the function reaches
// Supabase: method, auth header, JSON parsing, empty command. The
// downstream RLS-enforced behaviour is exercised by pgTAP tests and
// by the unit tests in src/lib/cli/.

import { assertEquals } from 'jsr:@std/assert@1';

import { handler } from './index.ts';

const URL = 'http://test/functions/v1/cli';

function jsonBody(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

Deno.test('cli — OPTIONS returns CORS headers', async () => {
  const res = await handler(new Request(URL, { method: 'OPTIONS' }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('cli — GET returns 405 not_found', async () => {
  const res = await handler(new Request(URL, { method: 'GET' }));
  assertEquals(res.status, 405);
  const body = (await res.json()) as { error: { code: string } };
  assertEquals(body.error.code, 'not_found');
});

Deno.test('cli — POST with no Authorization returns 401 unauthorized', async () => {
  const res = await handler(new Request(URL, jsonBody({ command: 'me' })));
  assertEquals(res.status, 401);
  const body = (await res.json()) as { error: { code: string }; request_id: string };
  assertEquals(body.error.code, 'unauthorized');
  // Every response carries a request_id for traceability.
  assertEquals(typeof body.request_id, 'string');
});

Deno.test('cli — POST with invalid JSON returns 400 parse_error', async () => {
  const res = await handler(
    new Request(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer kzn_read_x' },
      body: '{not json',
    }),
  );
  assertEquals(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assertEquals(body.error.code, 'parse_error');
});

Deno.test('cli — POST with empty command returns 400 parse_error', async () => {
  const res = await handler(
    new Request(URL, jsonBody({ command: '   ' }, { Authorization: 'Bearer kzn_read_x' })),
  );
  assertEquals(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assertEquals(body.error.code, 'parse_error');
});

Deno.test('cli — non-POST sets correct status code regardless of auth', async () => {
  const res = await handler(new Request(URL, { method: 'PUT' }));
  assertEquals(res.status, 405);
});
