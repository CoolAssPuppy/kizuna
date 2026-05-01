interface Options {
  now?: Date;
  locale?: string;
  timeZone?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * iMessage-style relative time:
 *   - same day: "1:05 PM"
 *   - previous day: "Yesterday 1:05 PM"
 *   - within 7 days: "Tuesday 1:05 PM"
 *   - older: "Jan 1 at 1:05 PM"
 */
export function messageTimeLabel(iso: string, options: Options = {}): string {
  const { now = new Date(), locale = undefined, timeZone = 'UTC' } = options;
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);

  const today = dateOnly(now, timeZone);
  const that = dateOnly(at, timeZone);
  if (today === that) return time;

  const dayDelta = Math.round((now.getTime() - at.getTime()) / DAY_MS);
  if (dayDelta === 1) return `Yesterday ${time}`;
  if (dayDelta > 1 && dayDelta < 7) {
    const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(at);
    return `${weekday} ${time}`;
  }

  const dateLabel = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(at);
  return `${dateLabel} at ${time}`;
}
