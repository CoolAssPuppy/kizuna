import { describe, expect, it } from 'vitest';

import { messageTimeLabel } from './timeLabel';

describe('messageTimeLabel', () => {
  const now = new Date('2027-01-15T15:30:00Z');

  it('formats today messages as the time of day', () => {
    expect(messageTimeLabel('2027-01-15T13:05:00Z', { now, locale: 'en-US', timeZone: 'UTC' }))
      .toMatch(/1:05/);
  });

  it('prefixes "Yesterday" for messages 1 calendar day ago', () => {
    const out = messageTimeLabel('2027-01-14T13:05:00Z', {
      now,
      locale: 'en-US',
      timeZone: 'UTC',
    });
    expect(out.startsWith('Yesterday')).toBe(true);
  });

  it('uses weekday name for messages within the past week', () => {
    const out = messageTimeLabel('2027-01-12T13:05:00Z', {
      now,
      locale: 'en-US',
      timeZone: 'UTC',
    });
    expect(out).toMatch(/Tue|Tuesday/);
  });

  it('uses month + day for messages older than a week', () => {
    const out = messageTimeLabel('2027-01-01T13:05:00Z', {
      now,
      locale: 'en-US',
      timeZone: 'UTC',
    });
    expect(out).toMatch(/Jan/);
  });
});
