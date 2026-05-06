/**
 * Pure helpers for the home-page countdown. Extracted from HomeScreen so
 * EventEtaPanel and any future test can import them without dragging in
 * the React tree.
 */

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isLive: boolean;
}

export function diffToCountdown(target: Date, now: Date = new Date()): Countdown {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, isLive: true };
  const total = Math.floor(ms / 60_000);
  return {
    days: Math.floor(total / (60 * 24)),
    hours: Math.floor((total / 60) % 24),
    minutes: total % 60,
    isLive: false,
  };
}

/**
 * 1-based day of the event when in progress; null otherwise. Day 1 is
 * the calendar day that contains startDate. Boundaries use the event
 * timezone so a 9pm-local start still rolls to Day 2 the next morning,
 * not at UTC midnight.
 */
export function dayOfEvent(
  startDate: string,
  endDate: string,
  timeZone: string,
  now: Date = new Date(),
): number | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (now < start || now > end) return null;
  const dayInTz = (d: Date): string =>
    d.toLocaleDateString('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const startKey = dayInTz(start);
  const nowKey = dayInTz(now);
  const startMidnight = new Date(`${startKey}T00:00:00Z`).getTime();
  const nowMidnight = new Date(`${nowKey}T00:00:00Z`).getTime();
  const dayIndex = Math.floor((nowMidnight - startMidnight) / (1000 * 60 * 60 * 24));
  return dayIndex + 1;
}

/** Slug used in the ETA terminal eyebrow ("supafest_2027"). */
export function eventSlug(
  name: string | null | undefined,
  location: string | null | undefined,
  startDate: string | null | undefined,
): string {
  const base = (location ?? name ?? 'event').toLowerCase().trim();
  const slug = base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const year = startDate ? new Date(startDate).getUTCFullYear() : new Date().getUTCFullYear();
  return `${slug}_${year}`;
}

/** "Add a Document" -> "add_a_document". Used by the queue rows. */
export function snakeFile(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function isEventInProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}
