import { describe, expect, it } from 'vitest';

import { mediumDateFormatter, mediumDateTimeFormatter, shortTimeFormatter } from './formatters';

const SAMPLE = new Date('2027-01-15T15:30:00Z');

describe('formatters', () => {
  it('mediumDateFormatter renders a localised date string', () => {
    const out = mediumDateFormatter.format(SAMPLE);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/2027/);
  });

  it('mediumDateTimeFormatter renders both date and time', () => {
    const out = mediumDateTimeFormatter.format(SAMPLE);
    expect(out).toMatch(/2027/);
  });

  it('shortTimeFormatter renders an HH:MM-style label', () => {
    const out = shortTimeFormatter.format(SAMPLE);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formatters are reused across calls (Intl object identity)', () => {
    const a = mediumDateFormatter.format(SAMPLE);
    const b = mediumDateFormatter.format(SAMPLE);
    expect(a).toBe(b);
  });
});
