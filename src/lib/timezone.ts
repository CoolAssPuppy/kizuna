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
