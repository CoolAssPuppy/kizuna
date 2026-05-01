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
 * The "when this matters" timestamp for an itinerary row, computed
 * relative to the event city.
 *
 * For flights:
 *   - If the flight is ARRIVING at the event city (ends_tz matches the
 *     event timezone), use the arrival time. The user cares about when
 *     they land.
 *   - If the flight is DEPARTING the event city (starts_tz matches the
 *     event timezone), use the departure time. The user cares about
 *     when they leave.
 *   - Otherwise the flight is purely transit between two non-event
 *     cities; fall back to the departure time.
 *
 * For everything else (sessions, hotels, transport): use starts_at.
 *
 * This keeps a JFK-to-YYC overnight flight on TODAY's day card (since
 * it lands today in Mountain time) and ahead of a 17:00 hotel
 * check-in, while a YYC-to-JFK departure on Day 5 stays anchored to
 * the morning departure rather than the evening landing.
 */
function displayTime(item: ItineraryItemRow, eventTimeZone: string): string {
  if (item.item_type !== 'flight') return item.starts_at;
  if (item.starts_tz === eventTimeZone) return item.starts_at;
  if (item.ends_at && item.ends_tz === eventTimeZone) return item.ends_at;
  return item.starts_at;
}

/**
 * Groups itinerary items into days, sorted ascending by display time
 * within each day. Returns the days in chronological order.
 */
export function groupItineraryByDay(
  items: ReadonlyArray<ItineraryItemRow>,
  timeZone: string,
): ItineraryDay[] {
  const map = new Map<string, ItineraryItemRow[]>();
  for (const item of items) {
    const key = toLocalDateKey(displayTime(item, timeZone), timeZone);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  const days: ItineraryDay[] = [];
  for (const [date, dayItems] of map.entries()) {
    dayItems.sort((a, b) => displayTime(a, timeZone).localeCompare(displayTime(b, timeZone)));
    days.push({ date, items: dayItems });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}
