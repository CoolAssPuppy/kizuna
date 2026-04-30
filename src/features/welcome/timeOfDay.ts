/**
 * Returns 'day' between 07:00 and 16:00 local time, otherwise 'night'.
 *
 * Pure function so the welcome screen's background switch is unit-testable
 * without faking Date globally inside the component.
 */
export type TimeOfDay = 'day' | 'night';

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 16; // i.e. switches to night at 16:00 (4 PM)

export function timeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = now.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'day' : 'night';
}

export function backgroundFor(period: TimeOfDay): string {
  return period === 'day' ? '/backgrounds/day.jpg' : '/backgrounds/night.jpg';
}
