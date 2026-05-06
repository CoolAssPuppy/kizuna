import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { addInvitations } from './api';

interface InsertCall {
  rows: Array<Record<string, unknown>>;
}

function makeClient(): { client: AppSupabaseClient; calls: InsertCall[] } {
  const calls: InsertCall[] = [];
  const insert = vi.fn((rows: Array<Record<string, unknown>>) => {
    calls.push({ rows });
    return Promise.resolve({ error: null }) as unknown as never;
  });
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as AppSupabaseClient, calls };
}

const eventId = '00000000-0000-0000-0000-000000000001';
const adminId = '00000000-0000-0000-0000-000000000010';

describe('addInvitations', () => {
  it('inserts every valid draft and reports counts', async () => {
    const { client, calls } = makeClient();
    const result = await addInvitations(client, {
      eventId,
      drafts: [
        { email: 'taylor@supabase.io', first_name: 'Taylor', last_name: 'Reed' },
        { email: 'avery@supabase.io', first_name: 'Avery', last_name: 'Lin' },
      ],
      existingEmails: [],
      invitedBy: adminId,
    });
    expect(result).toEqual({ inserted: 2, skipped_duplicates: 0, rejected_invalid: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.rows).toHaveLength(2);
  });

  it('skips drafts already in existingEmails (case-insensitively)', async () => {
    const { client } = makeClient();
    const result = await addInvitations(client, {
      eventId,
      drafts: [
        { email: 'Taylor@SUPABASE.IO', first_name: 'Taylor', last_name: 'Reed' },
        { email: 'avery@supabase.io', first_name: 'Avery', last_name: 'Lin' },
      ],
      existingEmails: ['taylor@supabase.io'],
      invitedBy: adminId,
    });
    expect(result.inserted).toBe(1);
    expect(result.skipped_duplicates).toBe(1);
  });

  it('skips intra-batch duplicates so a paste with repeats counts as one', async () => {
    const { client } = makeClient();
    const result = await addInvitations(client, {
      eventId,
      drafts: [
        { email: 'taylor@supabase.io', first_name: 'Taylor', last_name: 'Reed' },
        { email: 'TAYLOR@supabase.io', first_name: 'Taylor', last_name: 'Reed' },
        { email: 'taylor@supabase.io ', first_name: 'Taylor', last_name: 'Reed' },
      ],
      existingEmails: [],
      invitedBy: adminId,
    });
    expect(result.inserted).toBe(1);
    expect(result.skipped_duplicates).toBe(2);
  });

  it('rejects malformed rows without trying to insert them', async () => {
    const { client, calls } = makeClient();
    const result = await addInvitations(client, {
      eventId,
      drafts: [
        { email: 'no-at-sign', first_name: 'X', last_name: 'Y' },
        { email: 'taylor@supabase.io', first_name: '', last_name: 'Reed' },
        { email: 'avery@supabase.io', first_name: 'Avery', last_name: 'Lin' },
      ],
      existingEmails: [],
      invitedBy: adminId,
    });
    expect(result.inserted).toBe(1);
    expect(result.rejected_invalid).toBe(2);
    expect(calls[0]?.rows).toHaveLength(1);
  });

  it('does not call insert when nothing survived validation', async () => {
    const { client, calls } = makeClient();
    const result = await addInvitations(client, {
      eventId,
      drafts: [{ email: 'invalid', first_name: '', last_name: '' }],
      existingEmails: [],
      invitedBy: adminId,
    });
    expect(result).toEqual({ inserted: 0, skipped_duplicates: 0, rejected_invalid: 1 });
    expect(calls).toHaveLength(0);
  });
});
