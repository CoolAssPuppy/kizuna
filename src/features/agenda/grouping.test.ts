import { describe, expect, it } from 'vitest';

import { dayHeading, dayKey, groupSessionsByDay } from './grouping';

interface Sample {
  starts_at: string | null;
}

describe('agenda grouping', () => {
  it('keys sessions by ISO day in the event time zone', () => {
    expect(dayKey('2027-01-12T15:00:00Z', 'America/Edmonton')).toBe('2027-01-12');
    // 22:00 Edmonton is the next day in UTC; key follows local Edmonton day.
    expect(dayKey('2027-01-13T05:00:00Z', 'America/Edmonton')).toBe('2027-01-12');
  });

  it('groups sessions into ascending day buckets with a heading per bucket', () => {
    const sessions: Sample[] = [
      { starts_at: '2027-01-13T18:00:00Z' },
      { starts_at: '2027-01-12T16:00:00Z' },
      { starts_at: '2027-01-12T20:00:00Z' },
    ];
    const days = groupSessionsByDay(sessions, 'America/Edmonton');
    expect(days.map((d) => d.iso)).toEqual(['2027-01-12', '2027-01-13']);
    expect(days[0]!.sessions).toHaveLength(2);
    expect(days[1]!.sessions).toHaveLength(1);
    expect(days[0]!.heading).toMatch(/Jan/);
  });

  it('returns an empty list when there are no sessions', () => {
    expect(groupSessionsByDay([] as Sample[], 'UTC')).toEqual([]);
  });

  it('returns an empty key/heading for null inputs', () => {
    expect(dayKey(null, 'UTC')).toBe('');
    expect(dayHeading(null, 'UTC')).toBe('');
  });

  it('skips sessions with no starts_at (proposals) when grouping', () => {
    const sessions: Sample[] = [
      { starts_at: '2027-01-12T16:00:00Z' },
      { starts_at: null },
      { starts_at: '2027-01-13T18:00:00Z' },
    ];
    const days = groupSessionsByDay(sessions, 'America/Edmonton');
    expect(days.flatMap((d) => d.sessions)).toHaveLength(2);
  });
});
