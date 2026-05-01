import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Profile } from './matching';
import { locate, project } from './worldCoordinates';

interface Props {
  people: Profile[];
  mode: 'hometown' | 'current';
  onToggle: (next: 'hometown' | 'current') => void;
}

interface Pin {
  user: Profile;
  x: number;
  y: number;
}

const VIEW_W = 1000;
const VIEW_H = 500;
const GRATICULE_LON_STEP = 30;
const GRATICULE_LAT_STEP = 15;
const GRATICULE_LATS: number[] = [];
for (let lat = -90 + GRATICULE_LAT_STEP; lat < 90; lat += GRATICULE_LAT_STEP) {
  GRATICULE_LATS.push(lat);
}
const GRATICULE_LONS: number[] = [];
for (let lon = -180 + GRATICULE_LON_STEP; lon < 180; lon += GRATICULE_LON_STEP) {
  GRATICULE_LONS.push(lon);
}

function pinsFor(people: Profile[], mode: Props['mode']): Pin[] {
  const out: Pin[] = [];
  for (const p of people) {
    const point =
      mode === 'hometown'
        ? locate(p.hometown_city, p.hometown_country)
        : locate(p.current_city, p.current_country);
    if (!point) continue;
    const { x, y } = project(point, VIEW_W, VIEW_H);
    out.push({ user: p, x, y });
  }
  return out;
}

export function WorldMap({ people, mode, onToggle }: Props): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  const pins = useMemo(() => pinsFor(people, mode), [people, mode]);

  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-labelledby={titleId}
    >
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
              mode === 'hometown' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'
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
              mode === 'current' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('community.map.toggleCurrent')}
          </button>
        </div>
      </header>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mt-3 aspect-[2/1] w-full rounded-md bg-gradient-to-b from-muted/40 to-muted/10"
        role="img"
        aria-label={t('community.map.title')}
      >
        {GRATICULE_LATS.map((lat) => {
          const { y } = project({ lat, lon: 0 }, VIEW_W, VIEW_H);
          return (
            <line
              key={`lat-${lat}`}
              x1={0}
              y1={y}
              x2={VIEW_W}
              y2={y}
              stroke="currentColor"
              strokeOpacity={lat === 0 ? 0.25 : 0.08}
              strokeWidth={1}
            />
          );
        })}
        {GRATICULE_LONS.map((lon) => {
          const { x } = project({ lat: 0, lon }, VIEW_W, VIEW_H);
          return (
            <line
              key={`lon-${lon}`}
              x1={x}
              y1={0}
              x2={x}
              y2={VIEW_H}
              stroke="currentColor"
              strokeOpacity={lon === 0 ? 0.25 : 0.08}
              strokeWidth={1}
            />
          );
        })}

        {pins.map((pin) => (
          <g
            key={pin.user.user_id}
            style={{ transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            transform={`translate(${pin.x}, ${pin.y})`}
          >
            <circle r={9} fill="hsl(var(--primary))" fillOpacity={0.2} />
            <circle r={5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
            <title>
              {pin.user.first_name} {pin.user.last_name}
            </title>
          </g>
        ))}
      </svg>
    </section>
  );
}
