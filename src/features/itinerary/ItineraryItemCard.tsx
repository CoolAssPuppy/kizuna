import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { ITEM_META } from './itemMeta';
import type { ItineraryItemRow } from './types';

interface Props {
  item: ItineraryItemRow;
  /** Stagger index so each row fades in slightly behind the previous one. */
  index: number;
}

function formatTime(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone && timeZone !== 'UTC' ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function ItineraryItemCard({ item, index }: Props): JSX.Element {
  const { t } = useTranslation();
  const meta = ITEM_META[item.item_type];
  const Icon = meta.Icon;
  // Each row renders in its own zone — a SFO→YYC flight shows departure
  // time in PT and arrival in MT even when both timestamps live as UTC.
  const startLabel = formatTime(item.starts_at, item.starts_tz);
  const endLabel = item.ends_at
    ? formatTime(item.ends_at, item.ends_tz ?? item.starts_tz)
    : null;

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

      <article
        className={cn(
          'group flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-all sm:flex-row sm:items-start sm:gap-4',
          'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
          item.is_conflict && 'border-destructive/50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            meta.chipClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

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

          {item.subtitle ? (
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {item.includes_guest ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {t('itinerary.withGuest')}
              </span>
            ) : null}
            {item.is_conflict ? (
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {t('itinerary.conflict')}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
