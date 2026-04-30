import { describe, expect, it } from 'vitest';

import { isThemeId, SUPPORTED_THEMES } from './theme';

describe('isThemeId', () => {
  it('accepts every supported theme', () => {
    for (const theme of SUPPORTED_THEMES) {
      expect(isThemeId(theme)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isThemeId('chartreuse')).toBe(false);
    expect(isThemeId('')).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });
});
