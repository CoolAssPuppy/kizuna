/**
 * Jet-lag tip pool. Each entry is a literal English string rather than
 * an i18n key because the JetLagFighter card is intentionally locale-
 * specific copy in Phase 1 — once we ship a second locale we'll lift
 * each tip into common.json under home.jetLag.tipPool.<id>.
 *
 * The pool is a curated set of evidence-backed advice (CDC traveler
 * health, Sleep Foundation, NIH circadian-rhythm reviews). The
 * `direction` discriminator lets us filter out advice that does not
 * apply when the attendee isn't shifting timezones in that direction;
 * `any` tips are universal and rotate freely.
 */

export interface JetLagTip {
  id: string;
  text: string;
  /**
   * 'east' / 'west' tips only show up when the attendee is travelling
   * in that direction; 'any' is universal.
   */
  direction: 'east' | 'west' | 'any';
}

export const JET_LAG_TIPS: ReadonlyArray<JetLagTip> = [
  {
    id: 'shift-bedtime',
    direction: 'any',
    text: 'Shift bedtime 30–60 minutes per day for the few days before travel.',
  },
  {
    id: 'east-morning-light',
    direction: 'east',
    text: 'Get 30 minutes of bright morning light at your destination to pull your clock earlier.',
  },
  {
    id: 'west-evening-light',
    direction: 'west',
    text: 'Soak up bright evening light at your destination — it pushes your bedtime later.',
  },
  {
    id: 'east-melatonin',
    direction: 'east',
    text: 'A low dose (0.3–0.5 mg) of melatonin 30 minutes before destination bedtime helps eastward shifts only.',
  },
  {
    id: 'avoid-evening-light',
    direction: 'east',
    text: 'Wear sunglasses or stay indoors after sunset for the first day or two so you can fall asleep earlier.',
  },
  {
    id: 'morning-caffeine',
    direction: 'west',
    text: 'Caffeine in the morning is fine on westward trips; cut it 8 hours before bed.',
  },
  {
    id: 'no-late-caffeine',
    direction: 'any',
    text: 'No caffeine after noon (destination time) for the first few days.',
  },
  {
    id: 'hydrate',
    direction: 'any',
    text: 'Drink water often in flight — dry cabin air worsens jet lag fatigue.',
  },
  {
    id: 'skip-alcohol',
    direction: 'any',
    text: 'Skip alcohol on the plane. It fragments REM sleep and slows recovery.',
  },
  {
    id: 'eat-on-time',
    direction: 'any',
    text: 'Eat on destination meal times even if you are not hungry — meals anchor your body clock.',
  },
  {
    id: 'short-nap',
    direction: 'any',
    text: 'If you must nap on arrival day, keep it under 20 minutes.',
  },
  {
    id: 'walk-outdoors',
    direction: 'any',
    text: 'Take a 15-minute walk outdoors within hours of landing. Daylight + movement together reset the clock fastest.',
  },
  {
    id: 'cool-bedroom',
    direction: 'any',
    text: 'Keep the bedroom cool (60–67°F / 15–19°C). Body temperature drops as you fall asleep.',
  },
  {
    id: 'blackout',
    direction: 'any',
    text: 'Use an eye mask or blackout curtains the first few nights — destination light bleeds through eyelids.',
  },
  {
    id: 'noise',
    direction: 'any',
    text: 'White or pink noise can mask unfamiliar hotel sounds and consolidate sleep.',
  },
  {
    id: 'no-late-meal',
    direction: 'any',
    text: 'Avoid heavy meals within 3 hours of bed. Digestion delays sleep onset.',
  },
  {
    id: 'shower',
    direction: 'any',
    text: 'A hot shower 60–90 minutes before bed cools you afterward, accelerating sleep onset.',
  },
  {
    id: 'stay-in-bed',
    direction: 'any',
    text: 'If you wake at 3 a.m., stay in bed with eyes closed. Getting up resets you backwards.',
  },
  {
    id: 'time-change-on-board',
    direction: 'any',
    text: 'Set your watch to destination time the moment you board the plane.',
  },
  {
    id: 'gentle-exercise',
    direction: 'any',
    text: 'Light outdoor exercise the next morning beats an indoor workout for jet-lag recovery.',
  },
];

/**
 * Pick a tip from the pool that's relevant to the traveller's
 * direction. Selection is deterministic given a `seed` so the same user
 * sees the same tip across a single render pass; pass a fresh seed
 * (e.g. Date.now()) at render time to roll a new tip.
 */
export function pickJetLagTip(direction: 'east' | 'west' | 'none', seed: number): JetLagTip | null {
  const eligible = JET_LAG_TIPS.filter((tip) => {
    if (direction === 'none') return tip.direction === 'any';
    return tip.direction === 'any' || tip.direction === direction;
  });
  if (eligible.length === 0) return null;
  // Math.abs handles negative seeds; modulo wraps cleanly.
  const index = Math.abs(Math.floor(seed)) % eligible.length;
  return eligible[index] ?? null;
}
