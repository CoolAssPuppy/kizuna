import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { callEdgeFunction } from './edgeFunction';

function makeClient(
  result: { data: unknown; error: null } | { data: null; error: Error | string | null },
): AppSupabaseClient {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue(result),
    },
  } as unknown as AppSupabaseClient;
}

describe('callEdgeFunction', () => {
  it('returns the data payload when the response is successful', async () => {
    const client = makeClient({ data: { ok: true, count: 3 }, error: null });
    const out = await callEdgeFunction<{ ok: boolean; count: number }>(client, 'fn', {
      hello: 'world',
    });
    expect(out).toEqual({ ok: true, count: 3 });
  });

  it('throws when the response carries an Error instance', async () => {
    const err = new Error('boom');
    const client = makeClient({ data: null, error: err });
    await expect(callEdgeFunction(client, 'fn', {})).rejects.toBe(err);
  });

  it('wraps non-Error error values in an Error', async () => {
    const client = makeClient({ data: null, error: 'broken' });
    await expect(callEdgeFunction(client, 'fn', {})).rejects.toThrow('broken');
  });

  it('throws when the response payload is missing', async () => {
    const client = makeClient({ data: null, error: null });
    await expect(callEdgeFunction(client, 'fn', {})).rejects.toThrow(/no payload/i);
  });
});
