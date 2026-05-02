import { useTranslation } from 'react-i18next';

import { AirlineLogo } from '@/components/AirlineLogo';
import { cn } from '@/lib/utils';

import { ITEM_META } from './itemMeta';
import type { ItineraryItemRow } from './types';

/**
 * The flight->itinerary trigger formats the title as
 *   "<airline name> <flight number>"
 * (see supabase/schemas/80_functions_and_triggers.sql:335). The flight
 * number is the trailing whitespace-delimited token; everything before
 * it is the airline name. Returns null for any title that doesn't match
 * — the card falls back to the generic plane chip in that case.
 */
function extractAirlineName(title: string): string | null {
  const match = title.match(/^(.+?)\s+\S+$/);
  return match?.[1] ?? null;
}

interface Props {
  item: ItineraryItemRow;
  /** Stagger index so each row fades in slightly behind the previous one. */
  index: number;
  /** Click handler; when set, the card becomes a button. */
  onClick?: (item: ItineraryItemRow) => void;
}

function formatTime(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone && timeZone !== 'UTC' ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function ItineraryItemCard({ item, index, onClick }: Props): JSX.Element {
  const { t } = useTranslation();
  const meta = ITEM_META[item.item_type];
  const Icon = meta.Icon;
  // Each row renders in its own zone — a SFO→YYC flight shows departure
  // time in PT and arrival in MT even when both timestamps live as UTC.
  const startLabel = formatTime(item.starts_at, item.starts_tz);
  const endLabel = item.ends_at ? formatTime(item.ends_at, item.ends_tz ?? item.starts_tz) : null;

  const cardClass = cn(
    'group flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all sm:flex-row sm:items-start sm:gap-4',
    'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
    onClick && 'cursor-pointer',
  );

  const airlineName = item.item_type === 'flight' ? extractAirlineName(item.title) : null;
  const leading =
    item.item_type === 'flight' && airlineName ? (
      <AirlineLogo
        name={airlineName}
        className="h-10 w-10 shrink-0 rounded-lg bg-card object-contain p-1 ring-1 ring-border"
      />
    ) : (
      <span
        aria-hidden
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          meta.chipClass,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    );

  const body = (
    <>
      {leading}

      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold leading-snug">{item.title}</p>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {startLabel}
            {endLabel ? ` – ${endLabel}` : ''}
          </span>
        </div>

        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t(`itinerary.itemTypes.${item.item_type}`)}
        </p>

        {item.subtitle ? <p className="text-sm text-muted-foreground">{item.subtitle}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {item.includes_guest ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t('itinerary.withGuest')}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <li
      className="kizuna-fade-in relative pl-12"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-3 top-5 -ml-px h-3 w-3 rounded-full ring-4 ring-background',
          meta.dotClass,
        )}
      />
      {onClick ? (
        <button type="button" className={cardClass} onClick={() => onClick(item)}>
          {body}
        </button>
      ) : (
        <article className={cardClass}>{body}</article>
      )}
    </li>
  );
}
