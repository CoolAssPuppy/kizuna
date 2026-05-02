/**
 * Combine a YYYY-MM-DD date and HH:mm time interpreted as wall-clock in
 * the given IANA timezone, returning a UTC ISO string.
 *
 * Browsers do not expose a "build a Date in tz X" constructor, so we
 * compute the offset numerically for the requested instant: format the
 * UTC-equivalent timestamp in the target zone, read back what wall time
 * the host thinks that is, and shift by the difference. One iteration is
 * enough because the offset is constant within each DST regime (no zone
 * crosses more than one transition in a single day).
 */
export function zonedWallTimeToUtcIso(date: string, time: string, timeZone: string): string {
  const wallMs = Date.parse(`${date}T${time}:00Z`);
  const offsetMs = tzOffsetMs(wallMs, timeZone);
  return new Date(wallMs - offsetMs).toISOString();
}

/**
 * Convenience overload: takes a single "YYYY-MM-DDTHH:mm" string (the
 * shape an `<input type="datetime-local">` produces) and returns the
 * UTC ISO instant for that wall-clock in the supplied timezone.
 */
export function zonedDateTimeLocalToUtcIso(value: string, timeZone: string): string {
  const [date = '', time = ''] = value.split('T');
  return zonedWallTimeToUtcIso(date, time.slice(0, 5), timeZone);
}

/**
 * Inverse of zonedDateTimeLocalToUtcIso: format a UTC ISO timestamp as
 * a "YYYY-MM-DDTHH:mm" wall-clock string in the supplied timezone, ready
 * to drop into an `<input type="datetime-local">`.
 */
export function utcIsoToZonedDateTimeLocal(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const lookup = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  // Intl returns "24" for midnight in some locales; normalise to "00".
  const hour = lookup('hour') === '24' ? '00' : lookup('hour');
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}T${hour}:${lookup('minute')}`;
}

/** Offset of `timeZone` relative to UTC at the supplied instant, in milliseconds. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const lookup = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';
  const asUtc = Date.UTC(
    Number(lookup('year')),
    Number(lookup('month')) - 1,
    Number(lookup('day')),
    Number(lookup('hour')) % 24,
    Number(lookup('minute')),
    Number(lookup('second')),
  );
  return asUtc - utcMs;
}
