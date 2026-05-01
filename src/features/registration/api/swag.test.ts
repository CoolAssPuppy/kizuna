import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { loadSelfSwagSize, saveAdditionalGuestSwagSize, saveSelfSwagSize } from './swag';

function makeReadClient(row: unknown): AppSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    })),
  } as unknown as AppSupabaseClient;
}

function makeUpsertClient(): { client: AppSupabaseClient; upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    client: { from: vi.fn(() => ({ upsert })) } as unknown as AppSupabaseClient,
    upsert,
  };
}

describe('loadSelfSwagSize', () => {
  it('returns the row when present', async () => {
    const client = makeReadClient({
      user_id: 'u',
      additional_guest_id: null,
      tshirt_size: 'M',
      shoe_size_eu: 42,
    });
    const out = await loadSelfSwagSize(client, 'u');
    expect(out?.tshirt_size).toBe('M');
  });

  it('returns null when no row exists', async () => {
    const client = makeReadClient(null);
    expect(await loadSelfSwagSize(client, 'u')).toBeNull();
  });
});

describe('saveSelfSwagSize', () => {
  it('upserts with user_id and additional_guest_id null', async () => {
    const { client, upsert } = makeUpsertClient();
    await saveSelfSwagSize(client, 'u', { tshirtSize: 'L', shoeSizeEu: 43 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u',
        additional_guest_id: null,
        tshirt_size: 'L',
        shoe_size_eu: 43,
      }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });
});

describe('saveAdditionalGuestSwagSize', () => {
  it('upserts with additional_guest_id and user_id null', async () => {
    const { client, upsert } = makeUpsertClient();
    await saveAdditionalGuestSwagSize(client, 'g-1', {
      tshirtSize: 'XS',
      shoeSizeEu: null,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        additional_guest_id: 'g-1',
        tshirt_size: 'XS',
        shoe_size_eu: null,
      }),
      expect.objectContaining({ onConflict: 'additional_guest_id' }),
    );
  });
});
