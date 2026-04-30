import type { ItineraryDay, ItineraryItemRow } from './types';

/**
 * Returns a date key (YYYY-MM-DD) for the given timestamp in the supplied
 * timezone. Used to bucket itinerary items by day for the day-by-day view.
 *
 * Why we don't just call toISOString().slice(0,10): a flight that lands at
 * 23:30 local but 06:30 UTC the next day belongs on the *local* day. The
 * Intl.DateTimeFormat path respects timezone correctly.
 */
export function toLocalDateKey(timestampIso: string, timeZone: string): string {
  const date = new Date(timestampIso);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA gives YYYY-MM-DD which is the format we want for the key.
  return formatter.format(date);
}

/**
 * Groups itinerary items into days, sorted ascending by starts_at within
 * each day. Returns the days in chronological order.
 */
export function groupItineraryByDay(
  items: ReadonlyArray<ItineraryItemRow>,
  timeZone: string,
): ItineraryDay[] {
  const map = new Map<string, ItineraryItemRow[]>();
  for (const item of items) {
    const key = toLocalDateKey(item.starts_at, timeZone);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  const days: ItineraryDay[] = [];
  for (const [date, dayItems] of map.entries()) {
    dayItems.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    days.push({ date, items: dayItems });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

/**
 * Detects schedule conflicts: any item that overlaps another item for the
 * same user. Sets is_conflict true on returned rows.
 *
 * Note: in production the is_conflict column is set by a database trigger
 * once that lands. This helper exists so the client can render the same
 * signal during dev before the trigger ships.
 */
export function flagConflicts(items: ReadonlyArray<ItineraryItemRow>): ItineraryItemRow[] {
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const result = sorted.map((item) => ({ ...item, is_conflict: false }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]!;
      const b = result[j]!;
      const aEnd = a.ends_at ?? a.starts_at;
      // Standard half-open interval overlap: a.start < b.end and b.start < a.end.
      if (a.starts_at < (b.ends_at ?? b.starts_at) && b.starts_at < aEnd) {
        a.is_conflict = true;
        b.is_conflict = true;
      } else {
        // Sorted by start time, so once b starts after a ends nothing later overlaps a.
        break;
      }
    }
  }
  return result;
}
