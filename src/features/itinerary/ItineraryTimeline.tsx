import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { flagConflicts, groupItineraryByDay } from './grouping';
import { ItineraryItemCard } from './ItineraryItemCard';
import type { ItineraryItemRow } from './types';

interface Props {
  items: ReadonlyArray<ItineraryItemRow>;
  timeZone: string;
}

const DAY_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const SHORT_DAY_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
});

export function ItineraryTimeline({ items, timeZone }: Props): JSX.Element {
  const { t } = useTranslation();
  const days = useMemo(
    () => groupItineraryByDay(flagConflicts(items), timeZone),
    [items, timeZone],
  );

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/40 p-10 text-center text-sm text-muted-foreground">
        {t('itinerary.empty')}
      </div>
    );
  }

  return (
    <ol className="space-y-10">
      {days.map((day, dayIndex) => {
        const date = new Date(`${day.date}T12:00:00Z`);
        return (
          <li
            key={day.date}
            className="kizuna-fade-in"
            style={{ animationDelay: `${dayIndex * 80}ms` }}
          >
            <header className="mb-4 flex items-baseline gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {SHORT_DAY_FMT.format(date)}
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{DAY_FMT.format(date)}</h2>
            </header>

            <div className="relative">
              <span
                aria-hidden
                className="absolute left-[18px] top-2 h-[calc(100%-1rem)] w-px bg-border"
              />
              <ul className="space-y-3">
                {day.items.map((item, itemIndex) => (
                  <ItineraryItemCard key={item.id} item={item} index={itemIndex} />
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
