import { Plane } from 'lucide-react';
import { useState } from 'react';

import airlinesData from '@/data/airlines.json';
import { cn } from '@/lib/utils';

interface AirlineRecord {
  readonly iata: string;
  readonly icao: string;
  readonly name: string;
}

const AIRLINES = airlinesData as ReadonlyArray<AirlineRecord>;
const BY_ICAO = new Map(AIRLINES.map((a) => [a.icao, a]));
const BY_IATA = new Map(AIRLINES.map((a) => [a.iata, a]));
// Lowercased name => record. Catches "Air Canada" alongside "AC"/"ACA".
const BY_NAME = new Map(AIRLINES.map((a) => [normalizeName(a.name), a]));

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface AirlineLogoProps {
  /** IATA code (e.g. 'AA'). Preferred. */
  iata?: string | null;
  /** ICAO code (e.g. 'AAL'). Used to look up IATA when iata is absent. */
  icao?: string | null;
  /** Airline name; rendered as alt text and shown if the logo fails to load. */
  name?: string | null;
  /** Tailwind size classes — defaults to a height-only constraint so the logo's intrinsic aspect ratio is preserved. */
  className?: string;
}

/**
 * Renders an airline logo from /public/airline-logos/{IATA}.png.
 *
 * The logos in that directory are pre-fetched from Daisycon by
 * scripts/fetch-airline-logos.mjs against the curated list in
 * src/data/airlines.json. When a code isn't in our top-100 set, or
 * when the image 404s for any reason, we fall back to a neutral plane
 * glyph so flight rows always have *something* in the leading slot.
 */
export function AirlineLogo({ iata, icao, name, className }: AirlineLogoProps): JSX.Element {
  const [broken, setBroken] = useState(false);
  const resolved = resolveCodes({ iata, icao, name });
  const finalIata = resolved?.iata ?? null;
  const finalName = name ?? resolved?.name ?? null;

  if (!finalIata || broken) {
    return (
      <span
        aria-label={finalName ?? 'Airline'}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-neutral-700',
          className,
        )}
      >
        <Plane aria-hidden className="h-4 w-4" />
      </span>
    );
  }

  // Wrap the PNG in a white pill so the dark-on-transparent artwork
  // stays legible regardless of theme (light, supa, hermione, kirk,
  // barbie). The pill is the industry-standard "logo on a sticker"
  // treatment booking apps use; it costs us a few px of horizontal
  // space but never hides the brand colour.
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-md bg-white px-1.5',
        className,
      )}
    >
      <img
        src={`/airline-logos/${finalIata}.png`}
        alt={finalName ?? finalIata}
        onError={() => setBroken(true)}
        className="h-5 w-auto object-contain"
        loading="lazy"
      />
    </span>
  );
}

function resolveCodes({
  iata,
  icao,
  name,
}: {
  iata?: string | null | undefined;
  icao?: string | null | undefined;
  name?: string | null | undefined;
}): AirlineRecord | null {
  if (iata) {
    const upper = iata.toUpperCase();
    const hit = BY_IATA.get(upper);
    if (hit) return hit;
    return { iata: upper, icao: icao?.toUpperCase() ?? '', name: name ?? '' };
  }
  if (icao) {
    const hit = BY_ICAO.get(icao.toUpperCase());
    if (hit) return hit;
  }
  if (name) {
    const norm = normalizeName(name);
    if (BY_NAME.has(norm)) return BY_NAME.get(norm)!;
    // Fallback: prefix match. "Air Canada Express" should still resolve
    // to Air Canada. Keep this last so exact wins.
    for (const [key, record] of BY_NAME) {
      if (norm.startsWith(key) || key.startsWith(norm)) return record;
    }
  }
  return null;
}
