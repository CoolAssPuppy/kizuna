import { describe, expect, it } from 'vitest';

import { groupItineraryByDay, toLocalDateKey } from './grouping';
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

  it('inbound flight to event city uses ARRIVAL time so an overnight flight lands on the right day', () => {
    // Flight: departs Apr 11 17:00 UTC at JFK (America/New_York), lands
    // Apr 12 08:00 UTC at YYC (America/Edmonton, the event tz).
    // Hotel: 5pm check-in same day in Edmonton tz.
    // Both should bucket to Apr 12 in the event tz; flight first.
    const flight = makeItem({
      item_type: 'flight',
      starts_at: '2027-04-11T17:00:00Z',
      starts_tz: 'America/New_York',
      ends_at: '2027-04-12T08:00:00Z',
      ends_tz: 'America/Edmonton',
    });
    const hotel = makeItem({
      item_type: 'accommodation',
      starts_at: '2027-04-12T17:00:00Z',
      starts_tz: 'America/Edmonton',
      ends_at: null,
    });
    const grouped = groupItineraryByDay([hotel, flight], 'America/Edmonton');
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.date).toBe('2027-04-12');
    expect(grouped[0]?.items.map((i) => i.item_type)).toEqual(['flight', 'accommodation']);
  });

  it('outbound flight from event city uses DEPARTURE time, not the landing-elsewhere time', () => {
    // Flight YYC -> JFK on Apr 15: departs 14:00 Mountain (= 20:00 UTC),
    // lands 23:00 Eastern (= 03:00 UTC Apr 16). The card belongs to
    // Apr 15 (departure day), and within Apr 15 it should sort by the
    // 14:00 departure, not the 23:00 landing in a different city.
    const lunch = makeItem({
      item_type: 'session',
      starts_at: '2027-04-15T18:00:00Z',
      starts_tz: 'America/Edmonton',
    });
    const flight = makeItem({
      item_type: 'flight',
      starts_at: '2027-04-15T20:00:00Z',
      starts_tz: 'America/Edmonton',
      ends_at: '2027-04-16T03:00:00Z',
      ends_tz: 'America/New_York',
    });
    const grouped = groupItineraryByDay([flight, lunch], 'America/Edmonton');
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.date).toBe('2027-04-15');
    expect(grouped[0]?.items.map((i) => i.item_type)).toEqual(['session', 'flight']);
  });
});
