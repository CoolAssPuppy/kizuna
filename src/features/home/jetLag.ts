/**
 * Jet lag helpers. Computes the timezone delta between the user's home
 * and the event location, and classifies severity. Tips themselves live
 * in i18n; this module only does the math.
 */

export type JetLagDirection = 'east' | 'west' | 'none';
export type JetLagSeverity = 'mild' | 'moderate' | 'severe';

const QUIET_THRESHOLD = 2;

/**
 * Difference in hours between the destination zone and the home zone at
 * a given instant. Positive means the destination clock is ahead of
 * home (eastbound travel).
 */
export function offsetHoursBetween(
  homeZone: string,
  destZone: string,
  at: Date = new Date(),
): number {
  const ms = zoneOffsetMs(destZone, at) - zoneOffsetMs(homeZone, at);
  return Math.round((ms / 3_600_000) * 10) / 10 || 0;
}

function zoneOffsetMs(zone: string, at: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - at.getTime();
}

export function jetLagDirection(offsetHours: number): JetLagDirection {
  if (Math.abs(offsetHours) <= QUIET_THRESHOLD) return 'none';
  return offsetHours > 0 ? 'east' : 'west';
}

export function jetLagSeverity(offsetHours: number): JetLagSeverity {
  const abs = Math.abs(offsetHours);
  if (abs >= 8) return 'severe';
  if (abs >= 5) return 'moderate';
  return 'mild';
}
