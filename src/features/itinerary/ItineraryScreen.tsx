import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useOnlineStatus } from '@/lib/useOnlineStatus';

import { CheckinCard } from './CheckinCard';
import { flagConflicts, groupItineraryByDay } from './grouping';
import { useItinerary } from './useItinerary';
import type { ItineraryItemRow, ItineraryItemType } from './types';

interface Props {
  eventId: string;
}

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

const DAY_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const localTimeZone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

const TYPE_DOT: Record<ItineraryItemType, string> = {
  session: 'bg-emerald-500',
  flight: 'bg-sky-500',
  transport: 'bg-amber-500',
  accommodation: 'bg-violet-500',
  announcement: 'bg-zinc-500',
  reminder: 'bg-rose-500',
};

export function ItineraryScreen({ eventId }: Props): JSX.Element {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { data, isLoading, error } = useItinerary({ eventId });

  const days = useMemo(() => {
    const items = flagConflicts(data ?? []);
    return groupItineraryByDay(items, localTimeZone);
  }, [data]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-8 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('itinerary.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('itinerary.subtitle')}</p>
        {!online ? (
          <p
            role="status"
            className="inline-flex rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
          >
            {t('itinerary.offline')}
          </p>
        ) : null}
      </header>

      <CheckinCard eventId={eventId} />

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('itinerary.empty')}</p>
      ) : (
        <ol className="space-y-8">
          {days.map((day) => (
            <li key={day.date} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {DAY_FMT.format(new Date(`${day.date}T12:00:00Z`))}
              </h2>
              <ul className="space-y-2">
                {day.items.map((item) => (
                  <ItineraryRow key={item.id} item={item} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

interface RowProps {
  item: ItineraryItemRow;
}

function ItineraryRow({ item }: RowProps): JSX.Element {
  const { t } = useTranslation();
  const start = new Date(item.starts_at);
  const end = item.ends_at ? new Date(item.ends_at) : null;

  return (
    <li className="flex flex-row gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-col items-end gap-1 pt-0.5 text-sm font-medium">
        <span>{TIME_FMT.format(start)}</span>
        {end ? <span className="text-muted-foreground">{TIME_FMT.format(end)}</span> : null}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${TYPE_DOT[item.item_type]}`}
          />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t(`itinerary.itemTypes.${item.item_type}`)}
          </span>
        </div>
        <p className="font-medium leading-snug">{item.title}</p>
        {item.subtitle ? <p className="text-sm text-muted-foreground">{item.subtitle}</p> : null}
        {item.includes_guest ? (
          <p className="text-xs font-medium text-primary">{t('itinerary.withGuest')}</p>
        ) : null}
        {item.is_conflict ? (
          <p className="text-xs font-medium text-destructive">{t('itinerary.conflict')}</p>
        ) : null}
      </div>
    </li>
  );
}
