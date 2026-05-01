import { describe, expect, it } from 'vitest';

import { flagConflicts, groupItineraryByDay, toLocalDateKey } from './grouping';
import type { ItineraryItemRow } from './types';

function makeItem(overrides: Partial<ItineraryItemRow>): ItineraryItemRow {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    event_id: 'e1',
    item_type: 'session',
    source: 'self_registered',
    source_id: null,
    title: 'Item',
    subtitle: null,
    starts_at: '2027-04-12T18:00:00Z',
    starts_tz: 'America/Edmonton',
    ends_at: '2027-04-12T19:00:00Z',
    ends_tz: 'America/Edmonton',
    includes_guest: false,
    is_conflict: false,
    is_offline_cached: true,
    updated_at: '2027-04-12T00:00:00Z',
    ...overrides,
  };
}

describe('toLocalDateKey', () => {
  it('returns YYYY-MM-DD in the requested timezone', () => {
    // 23:30 Mountain time on 12 April 2027 = 05:30 UTC on 13 April. Buckets
    // to the 12th when displayed in America/Edmonton (Banff timezone).
    expect(toLocalDateKey('2027-04-13T05:30:00Z', 'America/Edmonton')).toBe('2027-04-12');
    expect(toLocalDateKey('2027-04-13T05:30:00Z', 'UTC')).toBe('2027-04-13');
  });
});

describe('groupItineraryByDay', () => {
  it('sorts items within a day by starts_at', () => {
    const items = [
      makeItem({ starts_at: '2027-04-12T20:00:00Z' }),
      makeItem({ starts_at: '2027-04-12T18:00:00Z' }),
      makeItem({ starts_at: '2027-04-12T19:00:00Z' }),
    ];
    const grouped = groupItineraryByDay(items, 'UTC');
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.items.map((i) => i.starts_at)).toEqual([
      '2027-04-12T18:00:00Z',
      '2027-04-12T19:00:00Z',
      '2027-04-12T20:00:00Z',
    ]);
  });

  it('returns days in chronological order', () => {
    const items = [
      makeItem({ starts_at: '2027-04-13T10:00:00Z' }),
      makeItem({ starts_at: '2027-04-12T10:00:00Z' }),
      makeItem({ starts_at: '2027-04-14T10:00:00Z' }),
    ];
    const grouped = groupItineraryByDay(items, 'UTC');
    expect(grouped.map((d) => d.date)).toEqual(['2027-04-12', '2027-04-13', '2027-04-14']);
  });
});

describe('flagConflicts', () => {
  it('marks items that overlap', () => {
    const a = makeItem({ starts_at: '2027-04-12T18:00:00Z', ends_at: '2027-04-12T20:00:00Z' });
    const b = makeItem({ starts_at: '2027-04-12T19:00:00Z', ends_at: '2027-04-12T21:00:00Z' });
    const flagged = flagConflicts([a, b]);
    expect(flagged.every((item) => item.is_conflict)).toBe(true);
  });

  it('leaves non-overlapping items alone', () => {
    const a = makeItem({ starts_at: '2027-04-12T18:00:00Z', ends_at: '2027-04-12T19:00:00Z' });
    const b = makeItem({ starts_at: '2027-04-12T19:00:00Z', ends_at: '2027-04-12T20:00:00Z' });
    const flagged = flagConflicts([a, b]);
    expect(flagged.every((item) => item.is_conflict === false)).toBe(true);
  });

  it('handles items with no end time as point-in-time', () => {
    const a = makeItem({ starts_at: '2027-04-12T18:00:00Z', ends_at: null });
    const b = makeItem({ starts_at: '2027-04-12T18:00:00Z', ends_at: null });
    const flagged = flagConflicts([a, b]);
    // Two point events at exactly the same instant: per the half-open
    // interval semantics, they do not overlap. Ensures we don't false-positive.
    expect(flagged.every((item) => item.is_conflict === false)).toBe(true);
  });
});
