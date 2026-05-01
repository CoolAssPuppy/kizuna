import { describe, expect, it, vi } from 'vitest';

import { fetchHiBobByEmail, hibobStatus } from './hibob';

describe('hibobStatus', () => {
  it('reports live with both halves of the service-user credential', () => {
    expect(hibobStatus({ serviceUserId: 'id', serviceUserToken: 'tok' }).mode).toBe('live');
  });

  it('reports stubbed if either half is missing', () => {
    expect(hibobStatus({}).mode).toBe('stubbed');
    expect(hibobStatus({ serviceUserId: 'id' }).mode).toBe('stubbed');
    expect(hibobStatus({ serviceUserToken: 'tok' }).mode).toBe('stubbed');
  });
});

describe('fetchHiBobByEmail', () => {
  it('returns the stub row for a known seed email when no credentials are set', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const person = await fetchHiBobByEmail({}, 'paul@kizuna.dev');
    expect(person).not.toBeNull();
    expect(person?.workEmail).toBe('paul@kizuna.dev');
    expect(person?.tshirtSize).toBe('L');
    expect(person?.shoeSizeEu).toBe(44);
  });

  it('returns null when the email is unknown to the stub directory', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const person = await fetchHiBobByEmail({}, 'noone@kizuna.dev');
    expect(person).toBeNull();
  });

  it('POSTs /people/search with HTTP Basic auth and the right field paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          employees: [
            {
              id: 'h_1',
              email: 'a@b.com',
              firstName: 'A',
              surname: 'Bertram',
              displayName: 'A B',
              fullName: 'A Bertram',
              avatarUrl: 'https://cdn/avatar.jpg',
              work: {
                title: 'Engineer',
                department: 'Eng',
                site: 'London',
                startDate: '2023-01-01',
                custom: { field_tshirt: 1, field_shoe: 42 },
              },
              home: { privateEmail: 'a@gmail.com', mobilePhone: '+44 1' },
              address: { country: 'GB', city: 'London' },
              internal: { lifecycleStatus: 'Employed', status: 'active' },
              humanReadable: { work: { custom: { field_tshirt: 'Large' } } },
            },
          ],
        }),
    });

    const person = await fetchHiBobByEmail(
      {
        serviceUserId: 'svc_id',
        serviceUserToken: 'svc_tok',
        tshirtFieldId: 'field_tshirt',
        shoeFieldId: 'field_shoe',
        fetchImpl,
      },
      'a@b.com',
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://api.hibob.com/v1/people/search');
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
    interface SearchBody {
      filters: Array<{ fieldPath: string; operator: string; values: string[] }>;
      fields: string[];
      humanReadable: string;
    }
    const body = JSON.parse(call[1].body as string) as SearchBody;
    expect(body.filters[0]).toEqual({
      fieldPath: 'root.email',
      operator: 'equals',
      values: ['a@b.com'],
    });
    expect(body.fields).toEqual(expect.arrayContaining(['root.email', 'work.custom.field_tshirt']));
    expect(body.humanReadable).toBe('APPEND');

    expect(person).toMatchObject({
      hibobId: 'h_1',
      workEmail: 'a@b.com',
      legalName: 'A Bertram',
      department: 'Eng',
      jobTitle: 'Engineer',
      tshirtSize: 'Large',
      shoeSizeEu: 42,
      privateEmail: 'a@gmail.com',
      isActive: true,
    });
  });

  it('throws when the live API returns a non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    await expect(
      fetchHiBobByEmail({ serviceUserId: 'id', serviceUserToken: 'tok', fetchImpl }, 'a@b.com'),
    ).rejects.toThrow(/HiBob \/people\/search failed \(401\)/);
  });
});
