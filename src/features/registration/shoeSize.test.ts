import { describe, expect, it } from 'vitest';

import { EU_SHOE_SIZES, US_SHOE_SIZES, euToUs, toEu, usToEu } from './shoeSize';

describe('shoe size conversion', () => {
  it('exposes the supported US and EU size ladders', () => {
    expect(US_SHOE_SIZES).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(EU_SHOE_SIZES).toEqual([38, 39, 40, 41, 42, 43, 44, 45, 46, 47]);
  });

  it('converts whole US sizes to canonical EU integers', () => {
    expect(usToEu(8)).toBe(41);
    expect(usToEu(10)).toBe(43);
  });

  it('preserves half sizes when going US to EU', () => {
    expect(usToEu(9.5)).toBe(42.5);
  });

  it('converts EU integers back to US whole sizes', () => {
    expect(euToUs(42)).toBe(9);
    expect(euToUs(45)).toBe(12);
  });

  it('toEu passes EU values through unchanged and converts US values', () => {
    expect(toEu(41, 'eu')).toBe(41);
    expect(toEu(8, 'us')).toBe(41);
  });

  it('returns null for sizes outside the supported ladder', () => {
    expect(usToEu(99)).toBeNull();
    expect(euToUs(20)).toBeNull();
  });
});
