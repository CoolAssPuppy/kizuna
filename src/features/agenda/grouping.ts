/**
 * Day grouping helpers shared by the user-facing agenda viewer and the
 * admin agenda editor. Both screens render sessions broken into per-day
 * sections, with day labels and ISO keys derived in the event's time zone.
 */

export interface DayBucket<T> {
  iso: string;
  heading: string;
  sessions: T[];
}

export function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function dayHeading(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

export function groupSessionsByDay<T extends { starts_at: string }>(
  sessions: ReadonlyArray<T>,
  timeZone: string,
): DayBucket<T>[] {
  const map = new Map<string, T[]>();
  for (const s of sessions) {
    const key = dayKey(s.starts_at, timeZone);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(s);
    } else {
      map.set(key, [s]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, daySessions]) => ({
      iso,
      heading: dayHeading(daySessions[0]!.starts_at, timeZone),
      sessions: daySessions,
    }));
}
