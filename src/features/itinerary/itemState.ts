import type { ItineraryItemState } from './ItineraryItemCard';
import type { ItineraryItemRow } from './types';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Compute each item's state relative to "now":
 *   - past:    item has already ended
 *   - now:     "now" falls within [starts_at, ends_at]
 *   - next:    first item whose starts_at > now (only one)
 *   - future:  any item after the "next"
 *
 * Items without ends_at are treated as 1 hour long for the "now" check.
 */
export function computeItemStates(
  items: ReadonlyArray<ItineraryItemRow>,
  now: Date,
): Map<string, ItineraryItemState> {
  const nowMs = now.getTime();
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const states = new Map<string, ItineraryItemState>();
  let foundNext = false;
  for (const item of sorted) {
    const startMs = new Date(item.starts_at).getTime();
    const endMs = item.ends_at ? new Date(item.ends_at).getTime() : startMs + ONE_HOUR_MS;
    if (endMs <= nowMs) {
      states.set(item.id, 'past');
    } else if (startMs <= nowMs && nowMs < endMs) {
      states.set(item.id, 'now');
    } else if (!foundNext) {
      states.set(item.id, 'next');
      foundNext = true;
    } else {
      states.set(item.id, 'future');
    }
  }
  return states;
}
