import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { loadCommunityPeople } from './people';

function makeClient(rows: unknown[]): AppSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  } as unknown as AppSupabaseClient;
}

describe('loadCommunityPeople', () => {
  it('uses the dedicated first_name/last_name columns when present', async () => {
    const client = makeClient([
      {
        user_id: 'u1',
        hobbies: ['skiing'],
        hometown_city: 'Banff',
        hometown_country: 'CA',
        current_city: 'Toronto',
        current_country: 'CA',
        user: {
          email: 'lu@kizuna.dev',
          employee_profiles: {
            first_name: 'Lu',
            last_name: 'Liu',
            preferred_name: 'Lu',
            legal_name: 'Lu Liu',
            avatar_url: null,
          },
          guest_profiles: null,
        },
      },
    ]);
    const out = await loadCommunityPeople(client);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      user_id: 'u1',
      first_name: 'Lu',
      last_name: 'Liu',
      email: 'lu@kizuna.dev',
      hobbies: ['skiing'],
      hometown_city: 'Banff',
      current_country: 'CA',
    });
  });

  it('splits legal_name when first_name/last_name columns are null (legacy rows)', async () => {
    const client = makeClient([
      {
        user_id: 'u3',
        hobbies: [],
        hometown_city: null,
        hometown_country: null,
        current_city: null,
        current_country: null,
        user: {
          email: 'legacy@kizuna.dev',
          employee_profiles: {
            first_name: null,
            last_name: null,
            preferred_name: null,
            legal_name: 'Legacy Person',
            avatar_url: null,
          },
          guest_profiles: null,
        },
      },
    ]);
    const [person] = await loadCommunityPeople(client);
    expect(person?.first_name).toBe('Legacy');
    expect(person?.last_name).toBe('Person');
  });

  it('falls back to guest_profiles first_name + last_name when employee record is absent', async () => {
    const client = makeClient([
      {
        user_id: 'u2',
        hobbies: [],
        hometown_city: null,
        hometown_country: null,
        current_city: null,
        current_country: null,
        user: {
          email: 'guest@example.com',
          employee_profiles: null,
          guest_profiles: { first_name: 'Alex', last_name: 'Guest' },
        },
      },
    ]);
    const [person] = await loadCommunityPeople(client);
    expect(person?.first_name).toBe('Alex');
    expect(person?.last_name).toBe('Guest');
  });

  it('returns an empty array when there are no rows', async () => {
    const client = makeClient([]);
    expect(await loadCommunityPeople(client)).toEqual([]);
  });
});
