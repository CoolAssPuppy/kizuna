import { describe, expect, it } from 'vitest';

import { __TEST } from './NowNextCard';
import type { ItineraryItemRow } from './types';

const { findSlot } = __TEST;

function row(overrides: Partial<ItineraryItemRow>): ItineraryItemRow {
  return {
    id: 'i',
    user_id: 'u',
    event_id: 'e',
    source: 'assigned',
    source_id: null,
    title: 'Sample',
    subtitle: null,
    starts_at: '2027-01-12T00:00:00Z',
    starts_tz: 'UTC',
    ends_at: null,
    ends_tz: null,
    includes_guest: false,
    is_conflict: false,
    is_offline_cached: false,
    item_type: 'session',
    updated_at: '2027-01-12T00:00:00Z',
    ...overrides,
  };
}

describe('findSlot', () => {
  it('returns the item that contains "now" when one is in progress', () => {
    const now = new Date('2027-01-12T10:30:00Z');
    const items = [
      row({
        item_type: 'session',
        starts_at: '2027-01-12T10:00:00Z',
        ends_at: '2027-01-12T11:00:00Z',
      }),
    ];
    const slot = findSlot(items, now);
    expect(slot?.kind).toBe('now');
    expect(slot?.minutes).toBe(30);
  });

  it('returns the next upcoming item otherwise', () => {
    const now = new Date('2027-01-12T09:00:00Z');
    const items = [
      row({
        item_type: 'flight',
        starts_at: '2027-01-12T09:30:00Z',
        ends_at: '2027-01-12T11:30:00Z',
      }),
    ];
    const slot = findSlot(items, now);
    expect(slot?.kind).toBe('next');
    expect(slot?.minutes).toBe(30);
  });

  it('skips items that have already finished', () => {
    const now = new Date('2027-01-12T12:00:00Z');
    const items = [
      row({
        item_type: 'flight',
        starts_at: '2027-01-12T08:00:00Z',
        ends_at: '2027-01-12T09:00:00Z',
      }),
      row({
        id: 'next',
        item_type: 'session',
        starts_at: '2027-01-12T13:00:00Z',
        ends_at: '2027-01-12T14:00:00Z',
      }),
    ];
    const slot = findSlot(items, now);
    expect(slot?.item.id).toBe('next');
    expect(slot?.kind).toBe('next');
  });

  it('returns null when nothing is current or upcoming', () => {
    const now = new Date('2027-01-13T00:00:00Z');
    const items = [
      row({
        item_type: 'flight',
        starts_at: '2027-01-12T08:00:00Z',
        ends_at: '2027-01-12T09:00:00Z',
      }),
    ];
    expect(findSlot(items, now)).toBeNull();
  });
});
