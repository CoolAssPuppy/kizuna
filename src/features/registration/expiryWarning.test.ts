import { describe, expect, it } from 'vitest';

import { isExpiryRiskyForEvent } from './expiryWarning';

describe('isExpiryRiskyForEvent', () => {
  it('flags a passport that expires before the event ends', () => {
    expect(isExpiryRiskyForEvent('2027-01-01', '2027-04-16')).toBe(true);
  });

  it('flags a passport that expires within six months after the event', () => {
    expect(isExpiryRiskyForEvent('2027-08-01', '2027-04-16')).toBe(true);
  });

  it('does not flag a passport that expires more than six months after the event', () => {
    expect(isExpiryRiskyForEvent('2028-05-01', '2027-04-16')).toBe(false);
  });

  it('returns false for missing inputs', () => {
    expect(isExpiryRiskyForEvent(null, '2027-04-16')).toBe(false);
    expect(isExpiryRiskyForEvent('2027-04-16', null)).toBe(false);
    expect(isExpiryRiskyForEvent(undefined, undefined)).toBe(false);
  });

  it('returns false for invalid date strings', () => {
    expect(isExpiryRiskyForEvent('not-a-date', '2027-04-16')).toBe(false);
  });
});
