import { Star, StarOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

import type { AgendaSession } from './api';
import { dayKey, groupSessionsByDay } from './grouping';
import { useAgenda } from './useAgenda';

type EventRow = Database['public']['Tables']['events']['Row'];

interface Props {
  event: EventRow;
}

type FilterMode = 'all' | 'favorites';

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function AgendaScreen({ event }: Props): JSX.Element {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const { data, isLoading, error, toggleFavorite } = useAgenda(event.id);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10" aria-busy="true">
        <p className="text-muted-foreground">{t('agenda.loading')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  const sessions = data ?? [];
  const filteredByMode =
    filter === 'favorites' ? sessions.filter((s) => s.is_favorite) : sessions;
  const allDays = groupSessionsByDay(sessions, event.time_zone);
  const visible = dayFilter === 'all'
    ? filteredByMode
    : filteredByMode.filter((s) => dayKey(s.starts_at, event.time_zone) === dayFilter);
  const days = groupSessionsByDay(visible, event.time_zone);
  const now = Date.now();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('agenda.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('agenda.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-md border p-1">
          <FilterTab
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t('agenda.filters.all', { count: sessions.length })}
          />
          <FilterTab
            active={filter === 'favorites'}
            onClick={() => setFilter('favorites')}
            label={t('agenda.filters.favorites', {
              count: sessions.filter((s) => s.is_favorite).length,
            })}
          />
        </div>
        {allDays.length > 1 ? (
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label={t('agenda.dayFilterLabel')}
          >
            <option value="all">{t('agenda.allDays')}</option>
            {allDays.map((day) => (
              <option key={day.iso} value={day.iso}>
                {day.heading}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {filter === 'favorites' ? t('agenda.noFavorites') : t('agenda.empty')}
        </p>
      ) : (
        <div className="space-y-10">
          {days.map((day) => (
            <section key={day.iso} className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {day.heading}
              </h2>
              <ul className="space-y-3">
                {day.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    timeZone={event.time_zone}
                    isPast={new Date(session.ends_at).getTime() < now}
                    onToggleFavorite={() => toggleFavorite(session)}
                    favoriteLabel={t(
                      session.is_favorite ? 'agenda.unfavorite' : 'agenda.favorite',
                    )}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function FilterTab({ active, onClick, label }: FilterTabProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

interface SessionCardProps {
  session: AgendaSession;
  timeZone: string;
  isPast: boolean;
  onToggleFavorite: () => void;
  favoriteLabel: string;
}

function SessionCard({
  session,
  timeZone,
  isPast,
  onToggleFavorite,
  favoriteLabel,
}: SessionCardProps): JSX.Element {
  const Icon = session.is_favorite ? Star : StarOff;
  return (
    <li
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40',
        isPast && 'opacity-50',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium tabular-nums text-muted-foreground">
            {formatTime(session.starts_at, timeZone)} —{' '}
            {formatTime(session.ends_at, timeZone)}
            {session.location ? <span> · {session.location}</span> : null}
          </p>
          <h3 className="text-base font-semibold">{session.title}</h3>
          {session.subtitle ? (
            <p className="text-sm text-muted-foreground">{session.subtitle}</p>
          ) : null}
          {session.speaker_display_name || session.speaker_email ? (
            <p className="text-xs text-muted-foreground">
              {session.speaker_display_name ?? session.speaker_email}
            </p>
          ) : null}
          {session.abstract ? (
            <p className="pt-2 text-sm leading-relaxed text-foreground/80">{session.abstract}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favoriteLabel}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
            session.is_favorite
              ? 'text-amber-500 hover:bg-amber-100/40'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Icon aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
