import { describe, expect, it } from 'vitest';

import type { HiBobPerson } from './hibob';
import { planHiBobReconciliation, type ProfileSnapshot } from './hibobReconcile';

function makePerson(overrides: Partial<HiBobPerson>): HiBobPerson {
  return {
    hibobId: 'h_1',
    email: 'a@b.com',
    legalName: 'A Bertram',
    preferredName: 'A',
    department: 'Eng',
    team: 'DB',
    jobTitle: 'Eng',
    startDate: '2023-01-01',
    homeCountry: 'US',
    isActive: true,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProfileSnapshot>): ProfileSnapshot {
  return {
    user_id: 'u_1',
    hibob_id: 'h_1',
    legal_name: 'A Bertram',
    legal_name_source: 'hibob',
    legal_name_locked: false,
    department: 'Eng',
    team: 'DB',
    job_title: 'Eng',
    start_date: '2023-01-01',
    home_country: 'US',
    ...overrides,
  };
}

describe('planHiBobReconciliation', () => {
  it('returns no updates and no conflicts when everything matches', () => {
    const plan = planHiBobReconciliation({
      hibob: [makePerson({})],
      profiles: [makeProfile({})],
    });
    expect(plan.updatesByUser.size).toBe(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it('updates synced fields when they differ and are not locked', () => {
    const plan = planHiBobReconciliation({
      hibob: [makePerson({ jobTitle: 'Senior Engineer', team: 'Realtime' })],
      profiles: [makeProfile({})],
    });
    expect(plan.updatesByUser.get('u_1')).toEqual(
      expect.arrayContaining([
        { field: 'job_title', newValue: 'Senior Engineer' },
        { field: 'team', newValue: 'Realtime' },
      ]),
    );
    expect(plan.conflicts).toHaveLength(0);
  });

  it('records a conflict on legal_name when the local value is user-entered', () => {
    const plan = planHiBobReconciliation({
      hibob: [makePerson({ legalName: 'A Bertram-Smith' })],
      profiles: [makeProfile({ legal_name: 'Alex B', legal_name_source: 'user_entered' })],
    });
    expect(plan.updatesByUser.has('u_1')).toBe(false);
    expect(plan.conflicts).toEqual([
      {
        user_id: 'u_1',
        field: 'legal_name',
        kizunaValue: 'Alex B',
        externalValue: 'A Bertram-Smith',
      },
    ]);
  });

  it('records a conflict when legal_name_locked is true even if source is hibob', () => {
    const plan = planHiBobReconciliation({
      hibob: [makePerson({ legalName: 'A Bertram-Smith' })],
      profiles: [
        makeProfile({
          legal_name: 'A Bertram',
          legal_name_source: 'hibob',
          legal_name_locked: true,
        }),
      ],
    });
    expect(plan.conflicts).toHaveLength(1);
  });

  it('skips employees with no matching hibob_id', () => {
    const plan = planHiBobReconciliation({
      hibob: [makePerson({ hibobId: 'h_99' })],
      profiles: [makeProfile({ hibob_id: 'h_1' })],
    });
    expect(plan.updatesByUser.size).toBe(0);
    expect(plan.conflicts).toHaveLength(0);
  });
});
