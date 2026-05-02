// Edge-function contract tests. Run via `npm run test:functions`.
//
// These tests assert the cheap, high-value gates: method, size cap,
// missing auth. They don't reach Supabase or OpenAI — anything that
// would require a real session goes in a separate integration suite.

import { assertEquals } from 'jsr:@std/assert@1';

import { handler } from './index.ts';

Deno.test('parse-itinerary returns 405 on GET', async () => {
  const res = await handler(new Request('http://test/parse-itinerary', { method: 'GET' }));
  assertEquals(res.status, 405);
});

Deno.test('parse-itinerary returns 401 with no Authorization header', async () => {
  const res = await handler(
    new Request('http://test/parse-itinerary', {
      method: 'POST',
      body: JSON.stringify({ text: 'hi' }),
    }),
  );
  assertEquals(res.status, 401);
  const body = (await res.json()) as { error: string };
  assertEquals(body.error, 'unauthorized');
});

Deno.test('parse-itinerary rejects payloads over the size cap', async () => {
  const big = 'x'.repeat(33 * 1024);
  const res = await handler(
    new Request('http://test/parse-itinerary', {
      method: 'POST',
      headers: { 'Content-Length': String(big.length) },
      body: big,
    }),
  );
  assertEquals(res.status, 413);
  const body = (await res.json()) as { error: string };
  assertEquals(body.error, 'payload_too_large');
});

Deno.test('parse-itinerary handles CORS preflight', async () => {
  const res = await handler(new Request('http://test/parse-itinerary', { method: 'OPTIONS' }));
  assertEquals(res.status, 200);
});
