import { describe, expect, it } from 'vitest';

import { offsetHoursBetween, jetLagDirection, jetLagSeverity } from './jetLag';

describe('offsetHoursBetween', () => {
  it('returns 0 for the same zone', () => {
    expect(
      offsetHoursBetween('America/New_York', 'America/New_York', new Date('2027-06-01T12:00:00Z')),
    ).toBe(0);
  });

  it('returns ~3 for SF -> NY in summer', () => {
    const out = offsetHoursBetween(
      'America/Los_Angeles',
      'America/New_York',
      new Date('2027-06-01T12:00:00Z'),
    );
    expect(out).toBe(3);
  });

  it('returns negative when destination is west of home', () => {
    const out = offsetHoursBetween(
      'Europe/London',
      'America/Los_Angeles',
      new Date('2027-06-01T12:00:00Z'),
    );
    expect(out).toBeLessThan(0);
  });

  it('handles edge case of the date line', () => {
    const out = offsetHoursBetween(
      'Pacific/Auckland',
      'Pacific/Honolulu',
      new Date('2027-06-01T00:00:00Z'),
    );
    expect(out).toBeLessThan(0);
  });
});

describe('jetLagDirection', () => {
  it('returns "east" for positive offsets', () => {
    expect(jetLagDirection(5)).toBe('east');
  });

  it('returns "west" for negative offsets', () => {
    expect(jetLagDirection(-4)).toBe('west');
  });

  it('returns "none" for offsets within +-2 hours', () => {
    expect(jetLagDirection(0)).toBe('none');
    expect(jetLagDirection(1.5)).toBe('none');
    expect(jetLagDirection(-2)).toBe('none');
  });
});

describe('jetLagSeverity', () => {
  it('returns "mild" for 3-4 hour offsets', () => {
    expect(jetLagSeverity(3)).toBe('mild');
    expect(jetLagSeverity(-4)).toBe('mild');
  });

  it('returns "moderate" for 5-7 hour offsets', () => {
    expect(jetLagSeverity(6)).toBe('moderate');
    expect(jetLagSeverity(-7)).toBe('moderate');
  });

  it('returns "severe" for 8+ hour offsets', () => {
    expect(jetLagSeverity(9)).toBe('severe');
    expect(jetLagSeverity(-12)).toBe('severe');
  });
});
