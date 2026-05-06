import { describe, expect, it } from 'vitest';

import { COUNTRIES, dialCodeFor, isValidCountryCode } from './countries';

describe('isValidCountryCode', () => {
  it('accepts a known alpha-2 code in any case', () => {
    expect(isValidCountryCode('US')).toBe(true);
    expect(isValidCountryCode('us')).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(isValidCountryCode('XX')).toBe(false);
  });

  it('rejects empty or wrong-length input', () => {
    expect(isValidCountryCode('')).toBe(false);
    expect(isValidCountryCode('USA')).toBe(false);
    expect(isValidCountryCode('U')).toBe(false);
  });
});

describe('dialCodeFor', () => {
  it('returns the dial code for a known country', () => {
    expect(dialCodeFor('US')).toBe('1');
    expect(dialCodeFor('GB')).toBe('44');
    expect(dialCodeFor('JP')).toBe('81');
  });

  it('returns null for unknown or null input', () => {
    expect(dialCodeFor('XX')).toBeNull();
    expect(dialCodeFor(null)).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(dialCodeFor('us')).toBe('1');
  });
});

describe('COUNTRIES catalog', () => {
  it('contains every entry as a 2-character uppercase ISO code', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('has unique country codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
