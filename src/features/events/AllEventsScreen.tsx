import { useQuery } from '@tanstack/react-query';
import { Calendar, Check, MapPin, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useIsAdmin } from '@/features/auth/hooks';
import { fetchAllEvents, type EventRow } from '@/features/admin/api/events';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import {
  clearEventOverride,
  setEventOverride,
  useEventOverride,
} from './eventOverride';

function isPast(event: EventRow): boolean {
  return new Date(event.end_date) < new Date();
}

export function AllEventsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const isAdmin = useIsAdmin();
  const override = useEventOverride();

  const { data, isLoading, error } = useQuery({
    queryKey: ['all-events'],
    queryFn: () => fetchAllEvents(getSupabaseClient()),
  });

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <p className="text-sm text-muted-foreground">{t('admin.loading')}</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  const events = data ?? [];
  const liveEvent = events.find((e) => e.is_active);
  const viewingId = override ?? liveEvent?.id ?? null;

  function handleView(eventId: string): void {
    if (liveEvent && eventId === liveEvent.id) {
      clearEventOverride();
      show(t('events.cleared'));
      return;
    }
    setEventOverride(eventId);
    show(t('events.switched'));
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-8 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('events.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('events.subtitle')}</p>
        </div>
        {isAdmin ? (
          <Button asChild className="gap-2 self-start">
            <Link to="/admin/events/new">
              <Plus aria-hidden className="h-4 w-4" />
              {t('events.create')}
            </Link>
          </Button>
        ) : null}
      </header>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('events.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              viewing={viewingId === event.id}
              isOverriding={!!override}
              isAdmin={isAdmin}
              onView={() => handleView(event.id)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

interface EventCardProps {
  event: EventRow;
  viewing: boolean;
  isOverriding: boolean;
  isAdmin: boolean;
  onView: () => void;
}

function EventCard({
  event,
  viewing,
  isOverriding,
  isAdmin,
  onView,
}: EventCardProps): JSX.Element {
  const { t } = useTranslation();
  const past = isPast(event);
  return (
    <li
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md',
        viewing && 'ring-2 ring-primary/40',
      )}
    >
      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-primary/30 via-sky-500/20 to-emerald-500/20">
        {event.hero_image_url ? (
          <img
            src={event.hero_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {event.is_active ? (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow">
              {t('events.active')}
            </span>
          ) : null}
          {past ? (
            <span className="rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow backdrop-blur">
              {t('events.past')}
            </span>
          ) : null}
          {viewing && isOverriding ? (
            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
              {t('events.viewing')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">{event.name}</h3>
          {event.subtitle ? (
            <p className="text-sm text-muted-foreground">{event.subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar aria-hidden className="h-3.5 w-3.5" />
            {mediumDateFormatter.format(new Date(event.start_date))} —{' '}
            {mediumDateFormatter.format(new Date(event.end_date))}
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="h-3.5 w-3.5" />
              {event.location}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant={viewing ? 'outline' : 'default'}
            size="sm"
            onClick={onView}
            disabled={viewing && !isOverriding}
            className="flex-1 gap-2"
          >
            {viewing ? (
              <>
                <Check aria-hidden className="h-4 w-4" />
                {t('events.currentlyViewing')}
              </>
            ) : (
              t('events.view')
            )}
          </Button>
          {isAdmin ? (
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <Link to={`/admin/events/${event.id}`} aria-label={t('actions.edit')}>
                <Pencil aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
