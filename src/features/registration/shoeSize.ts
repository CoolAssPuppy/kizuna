/**
 * US ↔ EU shoe size conversion. Reference: men's unisex sizing chart.
 * The catalogue is intentionally tight — first-pass swag ordering covers
 * the common range. Half sizes pass through (US 9.5 → EU 42.5).
 */

interface ConversionPoint {
  us: number;
  eu: number;
}

const TABLE: ReadonlyArray<ConversionPoint> = [
  { us: 5, eu: 38 },
  { us: 6, eu: 39 },
  { us: 7, eu: 40 },
  { us: 8, eu: 41 },
  { us: 9, eu: 42 },
  { us: 10, eu: 43 },
  { us: 11, eu: 44 },
  { us: 12, eu: 45 },
  { us: 13, eu: 46 },
  { us: 14, eu: 47 },
];

const US_TO_EU = new Map(TABLE.map((p) => [p.us, p.eu]));
const EU_TO_US = new Map(TABLE.map((p) => [p.eu, p.us]));

export type ShoeSizeSystem = 'us' | 'eu';

export const US_SHOE_SIZES: ReadonlyArray<number> = TABLE.map((p) => p.us);
export const EU_SHOE_SIZES: ReadonlyArray<number> = TABLE.map((p) => p.eu);

export function usToEu(us: number): number | null {
  const exact = US_TO_EU.get(us);
  if (exact !== undefined) return exact;
  // Half size passes through with a 0.5 EU bump.
  if (US_TO_EU.has(Math.floor(us))) return (US_TO_EU.get(Math.floor(us)) ?? 0) + 0.5;
  return null;
}

export function euToUs(eu: number): number | null {
  const exact = EU_TO_US.get(eu);
  if (exact !== undefined) return exact;
  if (EU_TO_US.has(Math.floor(eu))) return (EU_TO_US.get(Math.floor(eu)) ?? 0) + 0.5;
  return null;
}

export function toEu(value: number, system: ShoeSizeSystem): number | null {
  return system === 'eu' ? value : usToEu(value);
}
