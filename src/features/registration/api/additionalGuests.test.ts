import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { saveAdditionalGuests } from './additionalGuests';

interface Existing {
  id: string;
  full_name: string;
  age_bracket: 'under_12' | 'teen';
  special_needs: string[];
  notes: string | null;
}

function makeClient(opts: {
  existing: Existing[];
  deleteSpy?: ReturnType<typeof vi.fn>;
  updateSpy?: ReturnType<typeof vi.fn>;
}): AppSupabaseClient {
  // The save flow per row chains .update(...).eq('id', ...). The eq()
  // call is what triggers the actual UPDATE, so we record the patch
  // payload in the update spy and resolve eq() with success.
  const update = opts.updateSpy ?? vi.fn();
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: opts.existing, error: null }),
      delete: vi.fn(() => ({
        in: opts.deleteSpy ?? vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      update: vi.fn((patch: Record<string, unknown>) => {
        update(patch);
        return {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    })),
  } as unknown as AppSupabaseClient;
}

describe('saveAdditionalGuests', () => {
  it('deletes rows missing from the new list and updates the survivors', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn();
    const client = makeClient({
      existing: [
        { id: 'a', full_name: 'A', age_bracket: 'under_12', special_needs: [], notes: null },
        { id: 'b', full_name: 'B', age_bracket: 'under_12', special_needs: [], notes: null },
      ],
      deleteSpy,
      updateSpy,
    });
    await saveAdditionalGuests(client, 'u', [
      { id: 'a', full_name: 'A renamed', special_needs: ['allergy'], notes: null },
    ]);
    expect(deleteSpy).toHaveBeenCalledWith('id', ['b']);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith({
      full_name: 'A renamed',
      special_needs: ['allergy'],
      notes: null,
    });
  });

  it('does not call update when given an empty list and deletes existing rows', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn();
    const client = makeClient({
      existing: [
        { id: 'a', full_name: 'A', age_bracket: 'under_12', special_needs: [], notes: null },
      ],
      deleteSpy,
      updateSpy,
    });
    await saveAdditionalGuests(client, 'u', []);
    expect(deleteSpy).toHaveBeenCalledWith('id', ['a']);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('does not call delete when there is nothing to remove', async () => {
    const deleteSpy = vi.fn();
    const updateSpy = vi.fn();
    const client = makeClient({
      existing: [
        { id: 'a', full_name: 'A', age_bracket: 'under_12', special_needs: [], notes: null },
      ],
      deleteSpy,
      updateSpy,
    });
    await saveAdditionalGuests(client, 'u', [
      { id: 'a', full_name: 'A', special_needs: [], notes: null },
    ]);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
