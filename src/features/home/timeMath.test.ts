import { describe, expect, it } from 'vitest';

import { dayOfEvent, diffToCountdown, eventSlug, isEventInProgress, snakeFile } from './timeMath';

describe('diffToCountdown', () => {
  it('returns isLive=true when the target is in the past', () => {
    const target = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-02T00:00:00Z');
    const result = diffToCountdown(target, now);
    expect(result.isLive).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
  });

  it('breaks down the diff into days/hours/minutes', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const target = new Date('2026-01-04T05:30:00Z');
    const result = diffToCountdown(target, now);
    expect(result.isLive).toBe(false);
    expect(result.days).toBe(3);
    expect(result.hours).toBe(5);
    expect(result.minutes).toBe(30);
  });

  it('treats exactly-now as live', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const target = new Date(now);
    expect(diffToCountdown(target, now).isLive).toBe(true);
  });
});

describe('dayOfEvent', () => {
  // Anchor every test to a venue timezone so a 9pm-local start still
  // rolls Day 2 to "the next morning" rather than UTC midnight.
  const TZ = 'America/Edmonton';

  it('returns null before the event starts', () => {
    const result = dayOfEvent(
      '2027-01-10T16:00:00Z',
      '2027-01-15T16:00:00Z',
      TZ,
      new Date('2026-12-01T00:00:00Z'),
    );
    expect(result).toBeNull();
  });

  it('returns null after the event ends', () => {
    const result = dayOfEvent(
      '2027-01-10T16:00:00Z',
      '2027-01-15T16:00:00Z',
      TZ,
      new Date('2027-02-01T00:00:00Z'),
    );
    expect(result).toBeNull();
  });

  it('returns 1 on the start date', () => {
    const result = dayOfEvent(
      '2027-01-10T16:00:00Z',
      '2027-01-15T16:00:00Z',
      TZ,
      new Date('2027-01-10T18:00:00Z'),
    );
    expect(result).toBe(1);
  });

  it('rolls to day 3 on calendar day 3', () => {
    const result = dayOfEvent(
      '2027-01-10T16:00:00Z',
      '2027-01-15T16:00:00Z',
      TZ,
      new Date('2027-01-12T16:00:00Z'),
    );
    expect(result).toBe(3);
  });

  it('returns null for invalid dates', () => {
    expect(dayOfEvent('not-a-date', '2027-01-15', TZ, new Date('2027-01-10'))).toBeNull();
  });
});

describe('eventSlug', () => {
  it('uses location when present, lowercased and snake_cased with the year', () => {
    expect(eventSlug('Supafest 2027', 'Banff, AB', '2027-01-10')).toBe('banff_ab_2027');
  });

  it('falls back to the event name when no location', () => {
    expect(eventSlug('Supafest 2027', null, '2027-01-10')).toBe('supafest_2027_2027');
  });

  it('falls back to "event" when nothing is set', () => {
    expect(eventSlug(null, null, null)).toBe(`event_${new Date().getUTCFullYear()}`);
  });
});

describe('snakeFile', () => {
  it('lowercases and snake_cases', () => {
    expect(snakeFile('Add a Document')).toBe('add_a_document');
  });
  it('preserves dots so file extensions survive', () => {
    expect(snakeFile('Photo Walk.csv')).toBe('photo_walk.csv');
  });
  it('strips leading and trailing separators', () => {
    expect(snakeFile('  Hello, World!  ')).toBe('hello_world');
  });
});

describe('isEventInProgress', () => {
  it('returns false when either bound is null', () => {
    expect(isEventInProgress(null, '2027-01-15')).toBe(false);
    expect(isEventInProgress('2027-01-10', null)).toBe(false);
  });

  it('returns true between start and end (inclusive)', () => {
    const now = new Date('2027-01-12T12:00:00Z').getTime();
    expect(isEventInProgress('2027-01-10T00:00:00Z', '2027-01-15T00:00:00Z', now)).toBe(true);
  });

  it('returns false outside the bounds', () => {
    const before = new Date('2027-01-09T00:00:00Z').getTime();
    const after = new Date('2027-01-16T00:00:00Z').getTime();
    expect(isEventInProgress('2027-01-10T00:00:00Z', '2027-01-15T00:00:00Z', before)).toBe(false);
    expect(isEventInProgress('2027-01-10T00:00:00Z', '2027-01-15T00:00:00Z', after)).toBe(false);
  });
});
