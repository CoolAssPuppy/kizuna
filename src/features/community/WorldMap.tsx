import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';

import type { Profile } from './matching';
import { locate } from './worldCoordinates';

interface Props {
  people: Profile[];
  mode: 'hometown' | 'current';
  onToggle: (next: 'hometown' | 'current') => void;
}

interface Pin {
  user: Profile;
  lat: number;
  lon: number;
}

// Public-domain world basemap copied from the world-atlas npm package
// during install. Refresh with:
//   cp node_modules/world-atlas/countries-110m.json public/world-110m.json
const GEOGRAPHY_URL = '/world-110m.json';

function pinsFor(people: Profile[], mode: Props['mode']): Pin[] {
  const out: Pin[] = [];
  for (const p of people) {
    const point =
      mode === 'hometown'
        ? locate(p.hometown_city, p.hometown_country)
        : locate(p.current_city, p.current_country);
    if (!point) continue;
    out.push({ user: p, lat: point.lat, lon: point.lon });
  }
  return out;
}

export function WorldMap({ people, mode, onToggle }: Props): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();
  const pins = useMemo(() => pinsFor(people, mode), [people, mode]);

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby={titleId}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {t('community.map.title')}
        </h2>
        <div role="tablist" className="flex gap-1 rounded-md border p-1 text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'hometown'}
            onClick={() => onToggle('hometown')}
            className={`rounded px-2 py-1 transition-colors ${
              mode === 'hometown'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {t('community.map.toggleHometown')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'current'}
            onClick={() => onToggle('current')}
            className={`rounded px-2 py-1 transition-colors ${
              mode === 'current'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {t('community.map.toggleCurrent')}
          </button>
        </div>
      </header>

      <div className="mt-3 aspect-[2/1] w-full overflow-hidden rounded-md bg-gradient-to-b from-muted/40 to-muted/10">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 160 }}
          width={1000}
          height={500}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEOGRAPHY_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string }> }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="hsl(var(--muted))"
                  stroke="hsl(var(--border))"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: 'hsl(var(--muted-foreground) / 0.2)' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
          {pins.map((pin) => (
            <Marker key={pin.user.user_id} coordinates={[pin.lon, pin.lat]}>
              <g style={{ transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <circle r={9} fill="hsl(var(--primary))" fillOpacity={0.2} />
                <circle
                  r={5}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
                <title>
                  {pin.user.first_name} {pin.user.last_name}
                </title>
              </g>
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </section>
  );
}
