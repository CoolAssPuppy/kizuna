import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { saveAdditionalGuests } from './additionalGuests';

interface Existing {
  id: string;
  full_name: string;
  age: number;
  special_needs: string[];
  notes: string | null;
}

function makeClient(opts: {
  existing: Existing[];
  deleteSpy?: ReturnType<typeof vi.fn>;
  upsertSpy?: ReturnType<typeof vi.fn>;
}): AppSupabaseClient {
  return {
    from: vi.fn(() => ({
      // Reads back the existing list
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: opts.existing, error: null }),
      // Writes
      delete: vi.fn(() => ({
        in: opts.deleteSpy ?? vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      upsert: opts.upsertSpy ?? vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  } as unknown as AppSupabaseClient;
}

describe('saveAdditionalGuests', () => {
  it('deletes rows missing from the new list and upserts the rest', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = makeClient({
      existing: [
        { id: 'a', full_name: 'A', age: 5, special_needs: [], notes: null },
        { id: 'b', full_name: 'B', age: 8, special_needs: [], notes: null },
      ],
      deleteSpy,
      upsertSpy,
    });
    await saveAdditionalGuests(client, 'u', [
      { id: 'a', full_name: 'A', age: 6, special_needs: [], notes: null },
    ]);
    expect(deleteSpy).toHaveBeenCalledWith('id', ['b']);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it('skips upsert when given an empty list and deletes existing rows', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const upsertSpy = vi.fn();
    const client = makeClient({
      existing: [{ id: 'a', full_name: 'A', age: 5, special_needs: [], notes: null }],
      deleteSpy,
      upsertSpy,
    });
    await saveAdditionalGuests(client, 'u', []);
    expect(deleteSpy).toHaveBeenCalledWith('id', ['a']);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('does not call delete when there is nothing to remove', async () => {
    const deleteSpy = vi.fn();
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = makeClient({
      existing: [{ id: 'a', full_name: 'A', age: 5, special_needs: [], notes: null }],
      deleteSpy,
      upsertSpy,
    });
    await saveAdditionalGuests(client, 'u', [
      { id: 'a', full_name: 'A', age: 6, special_needs: [], notes: null },
    ]);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
