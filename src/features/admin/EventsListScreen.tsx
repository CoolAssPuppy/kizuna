import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { fetchAllEvents, type EventRow } from './api/events';

function isPast(event: EventRow): boolean {
  return new Date(event.end_date) < new Date();
}

export function EventsListScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: () => fetchAllEvents(getSupabaseClient()),
  });

  if (isLoading) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }
  if (error) {
    return (
      <p role="alert" className="py-8 text-sm text-destructive">
        {error.message}
      </p>
    );
  }

  const events = data ?? [];

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.events.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.events.subtitle')}</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/admin/events/new">
            <Plus aria-hidden className="h-4 w-4" />
            {t('admin.events.create')}
          </Link>
        </Button>
      </header>

      {events.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{t('admin.events.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <Link
                to={`/admin/events/${event.id}`}
                className="flex flex-wrap items-start justify-between gap-3 hover:opacity-80"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{event.name}</h3>
                    {event.is_active ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {t('admin.events.active')}
                      </span>
                    ) : null}
                    {isPast(event) ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('admin.events.past')}
                      </span>
                    ) : null}
                  </div>
                  {event.subtitle ? (
                    <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                  ) : null}
                  <p className={cn('text-xs text-muted-foreground')}>
                    {mediumDateFormatter.format(new Date(event.start_date))} —{' '}
                    {mediumDateFormatter.format(new Date(event.end_date))}
                  </p>
                </div>
                {event.location ? (
                  <p className="text-sm text-muted-foreground">{event.location}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
