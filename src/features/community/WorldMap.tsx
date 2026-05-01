import { MapPin } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

import { Avatar } from '@/components/Avatar';

import { COUNTRIES } from './countries';
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

function countryName(code: string | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper)?.name ?? upper;
}

interface PinLocationLabel {
  city: string | null;
  country: string | null;
}

function locationLabel(label: PinLocationLabel): string | null {
  const country = countryName(label.country);
  if (label.city && country) return `${label.city}, ${country}`;
  return label.city ?? country;
}

export function WorldMap({ people, mode, onToggle }: Props): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();
  const pins = useMemo(() => pinsFor(people, mode), [people, mode]);
  const [hovered, setHovered] = useState<string | null>(null);

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
          {pins.map((pin) => {
            const isHovered = hovered === pin.user.user_id;
            return (
              <Marker
                key={pin.user.user_id}
                coordinates={[pin.lon, pin.lat]}
                onMouseEnter={() => setHovered(pin.user.user_id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  default: {
                    transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                    cursor: 'pointer',
                  },
                  hover: { cursor: 'pointer' },
                  pressed: { cursor: 'pointer' },
                }}
              >
                {/* Invisible 18px hit-target so the small dot is easy to hover. */}
                <circle r={18} fill="transparent" />
                <circle
                  r={isHovered ? 11 : 9}
                  fill="hsl(var(--primary))"
                  fillOpacity={isHovered ? 0.35 : 0.2}
                />
                <circle
                  r={isHovered ? 6 : 5}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
                {isHovered ? <PinTooltip person={pin.user} mode={mode} /> : null}
              </Marker>
            );
          })}
        </ComposableMap>
      </div>
    </section>
  );
}

interface TooltipProps {
  person: Profile;
  mode: 'hometown' | 'current';
}

/**
 * Hover card for a pin. Rendered inside the SVG via foreignObject so it
 * stays anchored to the marker as the map scales. Avatar comes from the
 * shared <Avatar> which signs storage URLs on demand and falls back to
 * a tile when none exists.
 */
function PinTooltip({ person, mode }: TooltipProps): JSX.Element {
  const fullName = `${person.first_name} ${person.last_name}`.trim();
  const initials = `${person.first_name.charAt(0)}${person.last_name.charAt(0)}`;
  const hometown = locationLabel({ city: person.hometown_city, country: person.hometown_country });
  const current = locationLabel({ city: person.current_city, country: person.current_country });
  const primary = mode === 'hometown' ? hometown : current;
  const secondary = mode === 'hometown' ? current : hometown;
  const moved = hometown && current && hometown !== current;

  return (
    <foreignObject
      x={-130}
      y={-176}
      width={260}
      height={172}
      style={{ overflow: 'visible', pointerEvents: 'none' }}
    >
      <div
        className="kizuna-fade-in flex h-full w-full flex-col items-center justify-end pb-3"
        style={{ filter: 'drop-shadow(0 12px 24px rgba(15,23,42,0.18))' }}
      >
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/95 px-5 pb-4 pt-5 text-center backdrop-blur-md">
          <div className="rounded-full bg-gradient-to-br from-primary to-sky-500 p-[2px]">
            <div className="rounded-full bg-card p-[3px]">
              <Avatar url={person.avatar_url} fallback={initials} size={64} />
            </div>
          </div>
          <p className="text-sm font-semibold leading-tight">{fullName || person.email}</p>
          {primary ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin aria-hidden className="h-3 w-3" />
              <span>{primary}</span>
            </div>
          ) : null}
          {moved && secondary ? (
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              {mode === 'hometown' ? `Now ${secondary}` : `From ${secondary}`}
            </p>
          ) : null}
        </div>
        <span
          aria-hidden
          className="mt-[-2px] h-2 w-2 rotate-45 border-b border-r border-border bg-card/95"
        />
      </div>
    </foreignObject>
  );
}
