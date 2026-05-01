import { describe, expect, it } from 'vitest';

import { buildShareUrl, generateShareToken } from './sharing';

describe('share token', () => {
  it('returns a URL-safe base64 string of consistent length', () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 random bytes -> 43 chars unpadded base64url
    expect(token).toHaveLength(43);
  });

  it('produces a different value on every call', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
  });
});

describe('buildShareUrl', () => {
  it('builds an absolute share URL anchored to the report path', () => {
    expect(buildShareUrl('https://kizuna.dev', 'tok123')).toBe(
      'https://kizuna.dev/share/reports/tok123',
    );
  });

  it('strips a trailing slash on the origin', () => {
    expect(buildShareUrl('https://kizuna.dev/', 'tok123')).toBe(
      'https://kizuna.dev/share/reports/tok123',
    );
  });
});
