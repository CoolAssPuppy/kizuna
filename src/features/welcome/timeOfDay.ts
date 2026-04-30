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

/**
 * CSS gradient used while the hero images are not yet placed in
 * /public/backgrounds. Day is alpine sunrise (warm), night is northern
 * lights (cool with a hint of green). Both pair with the dark overlay
 * applied in WelcomeScreen.
 */
export function fallbackGradientFor(period: TimeOfDay): string {
  return period === 'day'
    ? 'linear-gradient(180deg, #fde68a 0%, #fb923c 35%, #be123c 65%, #1e1b4b 100%)'
    : 'linear-gradient(180deg, #020617 0%, #0c1730 35%, #1e3a5f 60%, #134e4a 85%, #064e3b 100%)';
}
