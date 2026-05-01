import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { loadCommunityProfile, saveCommunityProfile } from './profile';

function makeReadClient(row: Record<string, unknown> | null): AppSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    })),
  } as unknown as AppSupabaseClient;
}

function makeUpsertClient(): { client: AppSupabaseClient; upsertSpy: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    client: { from: vi.fn(() => ({ upsert })) } as unknown as AppSupabaseClient,
    upsertSpy: upsert,
  };
}

describe('loadCommunityProfile', () => {
  it('returns sensible empty defaults when no row exists yet', async () => {
    const client = makeReadClient(null);
    const out = await loadCommunityProfile(client, 'u-1');
    expect(out).toEqual({
      user_id: 'u-1',
      bio: null,
      hobbies: [],
      fun_fact: null,
      hometown_city: null,
      hometown_country: null,
      current_city: null,
      current_country: null,
    });
  });

  it('returns the existing row verbatim when present', async () => {
    const client = makeReadClient({
      user_id: 'u-2',
      bio: 'hi',
      hobbies: ['skiing'],
      fun_fact: 'I once flew in a hot air balloon',
      hometown_city: 'Banff',
      hometown_country: 'CA',
      current_city: 'Toronto',
      current_country: 'CA',
    });
    const out = await loadCommunityProfile(client, 'u-2');
    expect(out.bio).toBe('hi');
    expect(out.hobbies).toEqual(['skiing']);
  });
});

describe('saveCommunityProfile', () => {
  it('upserts the row keyed on user_id', async () => {
    const { client, upsertSpy } = makeUpsertClient();
    await saveCommunityProfile(client, 'u-3', {
      bio: 'new bio',
      hobbies: ['photography'],
      fun_fact: null,
      hometown_city: 'Tokyo',
      hometown_country: 'JP',
      current_city: 'Berlin',
      current_country: 'DE',
    });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-3', bio: 'new bio' }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });
});
