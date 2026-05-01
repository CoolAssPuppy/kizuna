import { describe, expect, it } from 'vitest';

import { slugifyChannelName } from './slug';

describe('slugifyChannelName', () => {
  it('lowercases and joins with hyphens', () => {
    expect(slugifyChannelName('Coffee Club')).toBe('coffee-club');
  });

  it('replaces ampersand with "and"', () => {
    expect(slugifyChannelName('Coffee & Life')).toBe('coffee-and-life');
  });

  it('strips characters outside [a-z0-9-]', () => {
    expect(slugifyChannelName('🤘 Rock Show!!!')).toBe('rock-show');
  });

  it('collapses repeated hyphens', () => {
    expect(slugifyChannelName('Hello---World')).toBe('hello-world');
  });

  it('truncates to 32 characters at a hyphen boundary when possible', () => {
    expect(slugifyChannelName('a much longer channel name here that exceeds the limit')).toMatch(
      /^[a-z0-9-]{2,32}$/,
    );
  });

  it('returns null for unrenderable input', () => {
    expect(slugifyChannelName('!!!!')).toBeNull();
  });
});
