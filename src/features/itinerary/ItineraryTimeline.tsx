import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { flagConflicts, groupItineraryByDay } from './grouping';
import { ItineraryItemCard } from './ItineraryItemCard';
import type { ItineraryItemRow } from './types';

interface Props {
  items: ReadonlyArray<ItineraryItemRow>;
  timeZone: string;
  /** Event start date as YYYY-MM-DD so we can label "Day 1 of N". */
  eventStart?: string | null;
  /** Event end date as YYYY-MM-DD; combined with start gives the day count. */
  eventEnd?: string | null;
  /** Override now() for tests. Defaults to runtime today. */
  now?: Date;
}

const DAY_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const SHORT_DAY_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DAY_KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Whole-day delta between two YYYY-MM-DD keys. */
function daysBetween(fromKey: string, toKey: string): number {
  const fromMs = new Date(`${fromKey}T00:00:00Z`).getTime();
  const toMs = new Date(`${toKey}T00:00:00Z`).getTime();
  return Math.round((toMs - fromMs) / ONE_DAY_MS);
}

function dayPillIndex(
  dayKey: string,
  eventStart: string | null | undefined,
  eventEnd: string | null | undefined,
): { idx: number; total: number } | null {
  if (!eventStart || !eventEnd) return null;
  const idx = daysBetween(eventStart, dayKey) + 1;
  const total = daysBetween(eventStart, eventEnd) + 1;
  if (idx < 1 || idx > total) return null;
  return { idx, total };
}

export function ItineraryTimeline({
  items,
  timeZone,
  eventStart,
  eventEnd,
  now = new Date(),
}: Props): JSX.Element {
  const { t } = useTranslation();
  const days = useMemo(
    () => groupItineraryByDay(flagConflicts(items), timeZone),
    [items, timeZone],
  );
  const todayKeyValue = DAY_KEY_FMT.format(now);

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles aria-hidden className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-semibold tracking-tight">
          {t('itinerary.empty.title')}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {t('itinerary.empty.body')}
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-10">
      {days.map((day, dayIdx) => {
        const date = new Date(`${day.date}T12:00:00Z`);
        const isToday = day.date === todayKeyValue;
        const dayOfEvent = dayPillIndex(day.date, eventStart, eventEnd);
        let pillText: string;
        if (isToday) {
          pillText = t('itinerary.day.today');
        } else if (dayOfEvent) {
          pillText = t('itinerary.day.dayOf', { day: dayOfEvent.idx, total: dayOfEvent.total });
        } else {
          pillText = SHORT_DAY_FMT.format(date);
        }
        return (
          <li
            key={day.date}
            className="kizuna-fade-in"
            style={{ animationDelay: `${dayIdx * 80}ms` }}
          >
            <header className="mb-4 flex items-baseline gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-[0.18em] ${
                  isToday
                    ? 'bg-primary/15 text-primary'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {pillText.toUpperCase()}
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
