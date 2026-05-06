import { MapPin, Minus, Plus, RotateCcw } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';

import { COUNTRIES } from '@/lib/countries';
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

// Public-domain world basemap from the world-atlas npm package. The
// postinstall script in package.json copies it to public/ if it isn't
// already vendored, so a fresh `npm install` is enough — no manual cp.
const GEOGRAPHY_URL = '/world-110m.json';

// Marker style is referentially stable across renders so React's prop
// equality short-circuits the work for every Marker that didn't change.
const MARKER_STYLE = {
  default: {
    transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
    cursor: 'pointer',
  },
  hover: { cursor: 'pointer' },
  pressed: { cursor: 'pointer' },
} as const;

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
  // hovered tracks both the user_id (for the visual highlight on the
  // pin) AND the screen coordinates of the cursor so the tooltip can
  // render via portal at fixed coordinates — outside the SVG, immune
  // to clipping at the map's edge.
  const [hovered, setHovered] = useState<{ userId: string; x: number; y: number } | null>(null);
  const hoveredPin = hovered ? (pins.find((p) => p.user.user_id === hovered.userId) ?? null) : null;
  // ZoomableGroup expects center + zoom as controlled state. Default to
  // a near-1x view; +/- buttons step in 1.5x increments and the scroll
  // wheel handles fine-grained pinch zoom for free.
  const DEFAULT_CENTER: [number, number] = [0, 20];
  const DEFAULT_ZOOM = 1;
  const [zoomState, setZoomState] = useState<{ center: [number, number]; zoom: number }>({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  });

  function clampZoom(next: number): number {
    return Math.max(1, Math.min(8, next));
  }

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

      <div
        className="relative mt-3 aspect-[2/1] w-full overflow-hidden rounded-md"
        style={{ backgroundColor: 'var(--c-surface)' }}
      >
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 160 }}
          width={1000}
          height={500}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            center={zoomState.center}
            zoom={zoomState.zoom}
            minZoom={1}
            maxZoom={8}
            onMoveEnd={(next: { coordinates: [number, number]; zoom: number }) =>
              setZoomState({ center: next.coordinates, zoom: next.zoom })
            }
          >
            <Geographies geography={GEOGRAPHY_URL}>
              {({ geographies }: { geographies: Array<{ rsmKey: string }> }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="var(--c-map-land)"
                    stroke="var(--c-map-stroke)"
                    strokeWidth={0.6}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', fill: 'var(--c-accent)', fillOpacity: 0.45 },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
            {pins.map((pin) => {
              const isHovered = hovered?.userId === pin.user.user_id;
              return (
                <Marker
                  key={pin.user.user_id}
                  coordinates={[pin.lon, pin.lat]}
                  onMouseEnter={(e: React.MouseEvent) =>
                    setHovered({ userId: pin.user.user_id, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e: React.MouseEvent) =>
                    setHovered({ userId: pin.user.user_id, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setHovered(null)}
                  style={MARKER_STYLE}
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
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            aria-label={t('community.map.zoomIn')}
            onClick={() => setZoomState((prev) => ({ ...prev, zoom: clampZoom(prev.zoom * 1.5) }))}
          >
            <Plus aria-hidden className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            aria-label={t('community.map.zoomOut')}
            onClick={() => setZoomState((prev) => ({ ...prev, zoom: clampZoom(prev.zoom / 1.5) }))}
          >
            <Minus aria-hidden className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            aria-label={t('community.map.zoomReset')}
            onClick={() => setZoomState({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })}
          >
            <RotateCcw aria-hidden className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {hovered && hoveredPin
        ? createPortal(
            <PinTooltip
              person={hoveredPin.user}
              mode={mode}
              cursorX={hovered.x}
              cursorY={hovered.y}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

interface TooltipProps {
  person: Profile;
  mode: 'hometown' | 'current';
  /** clientX of the cursor — used to anchor the portal-rendered tooltip. */
  cursorX: number;
  /** clientY of the cursor. */
  cursorY: number;
}

/**
 * Hover card for a pin. Rendered into document.body via portal so it is
 * never clipped by the SVG canvas when a marker sits near the map's
 * edge. Position is fixed-coordinate from the cursor; the previous
 * foreignObject implementation lived inside the SVG and silently
 * vanished off-canvas for pins in the upper third of the map.
 */
function PinTooltip({ person, mode, cursorX, cursorY }: TooltipProps): JSX.Element {
  const fullName = `${person.first_name} ${person.last_name}`.trim();
  const initials = `${person.first_name.charAt(0)}${person.last_name.charAt(0)}`;
  const hometown = locationLabel({ city: person.hometown_city, country: person.hometown_country });
  const current = locationLabel({ city: person.current_city, country: person.current_country });
  const primary = mode === 'hometown' ? hometown : current;
  const secondary = mode === 'hometown' ? current : hometown;
  const moved = hometown && current && hometown !== current;

  // Card is 260x172. Anchor it slightly above and to the right of the
  // cursor by default; if either edge would clip the viewport, flip
  // to the opposite side. Renders fixed (not absolute) so page scroll
  // doesn't drift the card.
  const CARD_W = 260;
  const CARD_H = 172;
  const margin = 12;
  let left = cursorX + 16;
  let top = cursorY - CARD_H - 12;
  if (left + CARD_W + margin > window.innerWidth) left = cursorX - CARD_W - 16;
  if (top < margin) top = cursorY + 16;
  if (left < margin) left = margin;

  return (
    <div
      className="kizuna-fade-in pointer-events-none fixed z-50"
      style={{
        left,
        top,
        width: CARD_W,
        filter: 'drop-shadow(0 12px 24px rgba(15,23,42,0.18))',
      }}
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
    </div>
  );
}
