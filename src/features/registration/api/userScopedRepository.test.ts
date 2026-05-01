import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { createUserScopedRepository } from './userScopedRepository';

interface Form {
  needs: string[];
  notes: string | null;
}

function makeReadClient(row: Record<string, unknown> | null): AppSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    })),
  } as unknown as AppSupabaseClient;
}

function makeUpsertClient(): {
  client: AppSupabaseClient;
  upsertSpy: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    client: { from: vi.fn(() => ({ upsert })) } as unknown as AppSupabaseClient,
    upsertSpy: upsert,
  };
}

describe('createUserScopedRepository', () => {
  it('load returns null when no row exists', async () => {
    const repo = createUserScopedRepository<'accessibility_preferences', Form>({
      table: 'accessibility_preferences',
      toInsert: (userId, v) => ({ user_id: userId, ...v }),
    });
    const out = await repo.load(makeReadClient(null), 'u');
    expect(out).toBeNull();
  });

  it('load returns the row when present', async () => {
    const repo = createUserScopedRepository<'accessibility_preferences', Form>({
      table: 'accessibility_preferences',
      toInsert: (userId, v) => ({ user_id: userId, ...v }),
    });
    const out = await repo.load(
      makeReadClient({
        user_id: 'u',
        needs: ['mobility'],
        notes: 'hello',
        updated_at: '2027-01-01T00:00:00Z',
      }),
      'u',
    );
    expect(out?.needs).toEqual(['mobility']);
  });

  it('save upserts the toInsert payload keyed on user_id', async () => {
    const repo = createUserScopedRepository<'accessibility_preferences', Form>({
      table: 'accessibility_preferences',
      toInsert: (userId, v) => ({ user_id: userId, needs: v.needs, notes: v.notes }),
    });
    const { client, upsertSpy } = makeUpsertClient();
    await repo.save(client, 'u', { needs: ['vision'], notes: null });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u', needs: ['vision'], notes: null }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });
});
