import { describe, expect, it, vi } from 'vitest';

import { fetchHiBobDirectory, hibobStatus } from './hibob';

describe('hibobStatus', () => {
  it('reports live with a key', () => {
    expect(hibobStatus({ apiKey: 'k' }).mode).toBe('live');
  });
  it('reports stubbed without a key', () => {
    expect(hibobStatus({}).mode).toBe('stubbed');
  });
});

describe('fetchHiBobDirectory', () => {
  it('returns the stub directory when no key is configured', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const directory = await fetchHiBobDirectory({});
    expect(directory.length).toBeGreaterThan(0);
    expect(directory[0]?.hibobId).toEqual(expect.any(String));
    expect(directory[0]?.email).toContain('@');
  });

  it('calls the HiBob API and normalises rows when keyed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          employees: [
            {
              id: 'h_1',
              work: { email: 'a@b.com', department: 'Eng', team: 'DB', title: 'Eng' },
              personal: { displayName: 'A B', legalName: 'A Bertram' },
              home: { countryCode: 'GB' },
              state: 'active',
            },
            {
              id: 'h_2',
              work: { email: 'c@d.com' },
              personal: { displayName: 'C D' },
              state: 'terminated',
            },
          ],
        }),
    });

    const directory = await fetchHiBobDirectory({ apiKey: 'sk', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.hibob.com/v1/people',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(directory).toHaveLength(2);
    expect(directory[0]).toEqual({
      hibobId: 'h_1',
      email: 'a@b.com',
      legalName: 'A Bertram',
      preferredName: 'A B',
      department: 'Eng',
      team: 'DB',
      jobTitle: 'Eng',
      startDate: null,
      homeCountry: 'GB',
      isActive: true,
    });
    expect(directory[1]?.isActive).toBe(false);
  });

  it('throws when the HiBob API returns an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    await expect(fetchHiBobDirectory({ apiKey: 'sk', fetchImpl })).rejects.toThrow(
      /HiBob \/people failed/,
    );
  });
});
