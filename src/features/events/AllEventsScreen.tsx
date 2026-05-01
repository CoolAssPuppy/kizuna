import { useQuery } from '@tanstack/react-query';
import { Check, Pencil, Plus } from 'lucide-react';
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
        <ul className="space-y-3">
          {events.map((event) => {
            const viewing = viewingId === event.id;
            return (
              <li
                key={event.id}
                className={cn(
                  'rounded-lg border bg-card p-4 shadow-sm transition-colors',
                  viewing && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{event.name}</h3>
                      {event.is_active ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {t('events.active')}
                        </span>
                      ) : null}
                      {isPast(event) ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('events.past')}
                        </span>
                      ) : null}
                      {viewing && override ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                          {t('events.viewing')}
                        </span>
                      ) : null}
                    </div>
                    {event.subtitle ? (
                      <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {mediumDateFormatter.format(new Date(event.start_date))} —{' '}
                      {mediumDateFormatter.format(new Date(event.end_date))}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={viewing ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleView(event.id)}
                      disabled={viewing && !override}
                      className="gap-2"
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
                      <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                        <Link to={`/admin/events/${event.id}`} aria-label={t('actions.edit')}>
                          <Pencil aria-hidden className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
