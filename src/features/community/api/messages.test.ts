import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { broadcastToAllChannels, sendMessage, softDeleteMessage } from './messages';

function makeRpcClient(returnValue: number): AppSupabaseClient {
  const rpc = vi.fn<(name: string, args: unknown) => Promise<{ data: number | null; error: null }>>(
    () => Promise.resolve({ data: returnValue, error: null }),
  );
  return { rpc } as unknown as AppSupabaseClient;
}

function makeInsertClient(insertResult: { id: string }): AppSupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: insertResult, error: null }),
    })),
  } as unknown as AppSupabaseClient;
}

function makeUpdateClient(): { client: AppSupabaseClient; updateSpy: ReturnType<typeof vi.fn> } {
  const update = vi.fn().mockReturnThis();
  const eq = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    client: {
      from: vi.fn(() => ({ update, eq })),
    } as unknown as AppSupabaseClient,
    updateSpy: update,
  };
}

describe('sendMessage', () => {
  it('returns the inserted row id', async () => {
    const client = makeInsertClient({ id: 'm-123' });
    const out = await sendMessage(client, 'sender-1', { channelSlug: 'general', body: 'hi' });
    expect(out.id).toBe('m-123');
  });
});

describe('softDeleteMessage', () => {
  it('writes deleted_at as a timestamp', async () => {
    const { client, updateSpy } = makeUpdateClient();
    await softDeleteMessage(client, 'm-1');
    const args = updateSpy.mock.calls[0]?.[0] as { deleted_at?: string };
    expect(typeof args.deleted_at).toBe('string');
  });
});

describe('broadcastToAllChannels', () => {
  it('returns the number of channels written', async () => {
    const client = makeRpcClient(7);
    const out = await broadcastToAllChannels(client, 'hello team');
    expect(out).toBe(7);
  });
});
