import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { StatusDot } from '@/components/StatusDot';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { loadPersonalInfo } from '@/features/registration/api';
import { getSupabaseClient } from '@/lib/supabase';

import { CheckinAccessCard } from './CheckinAccessCard';
import { EventEtaPanel } from './components/EventEtaPanel';
import { EventStatsPanel } from './components/EventStatsPanel';
import { HomeQueue } from './components/HomeQueue';
import { SidebarEditorialCard } from './components/SidebarEditorialCard';
import { HomeMemoriesSection } from './HomeMemoriesSection';
import { JetLagFighter } from './JetLagFighter';
import { TeammateIcebreaker } from './TeammateIcebreaker';
import { eventSlug, isEventInProgress } from './timeMath';
import { useEditorialFeed } from './useEditorialFeed';
import { useEventStats } from './useEventStats';
import { useHomeFeed } from './useHomeFeed';

export function HomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;

  const { data: feed = [] } = useHomeFeed(eventId);
  const { data: stats } = useEventStats(eventId);
  const editorial = useEditorialFeed(eventId);

  const { data: profile } = useQuery({
    queryKey: ['profile', 'personalInfo', user?.id],
    queryFn: () => loadPersonalInfo(getSupabaseClient(), user!.id),
    enabled: !!user,
  });
  const preferredName =
    profile?.preferred_name ?? (user ? (user.email.split('@')[0] ?? null) : null);

  const slug = eventSlug(event?.name, event?.location, event?.start_date);
  const queueCount = feed.length + editorial.main.length;
  const summary = t('home.terminal.welcome', {
    event: event?.name ?? t('home.terminal.fallbackEvent'),
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
      <Hero
        preferredName={preferredName}
        summary={summary}
        eventSlug={slug}
        eventName={event?.name ?? null}
        startDate={event?.start_date ?? null}
        endDate={event?.end_date ?? null}
        startTimezone={event?.time_zone ?? 'UTC'}
        eventId={event?.id ?? null}
      />

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-10 lg:col-span-8">
          <HomeQueue feed={feed} editorial={editorial.main} count={queueCount} />
          {event ? <HomeMemoriesSection eventId={event.id} eventName={event.name} /> : null}
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <EventStatsPanel stats={stats} />
          {event ? <JetLagFighter eventTimeZone={event.time_zone} /> : null}
          <TeammateIcebreaker />
          {event ? (
            <div className="hidden lg:block">
              <CheckinAccessCard
                eventId={event.id}
                defaultOpen={isEventInProgress(event.start_date, event.end_date)}
              />
            </div>
          ) : null}
          {editorial.sidebar.map((item) => (
            <SidebarEditorialCard key={item.id} item={item} />
          ))}
        </aside>
      </div>
    </main>
  );
}

interface HeroProps {
  preferredName: string | null;
  summary: string;
  eventSlug: string;
  eventName: string | null;
  startDate: string | null;
  endDate: string | null;
  startTimezone: string;
  eventId: string | null;
}

function Hero({
  preferredName,
  summary,
  eventSlug: slug,
  eventName,
  startDate,
  endDate,
  startTimezone,
  eventId,
}: HeroProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="space-y-5 lg:col-span-8">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-c-dim">
          <span>// session active</span>
          <StatusDot active size={6} />
          <span className="text-c-accent" style={{ letterSpacing: '0.04em' }}>
            {t('home.terminal.connected')}
          </span>
        </div>
        <h1
          className="break-words font-extralight text-c-fg"
          style={{
            fontSize: 'clamp(36px, 8vw, 72px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          <span className="text-c-fg">&gt; {t('home.terminal.greeting')},</span>
          <br />
          {preferredName ?? t('home.terminal.fallbackName')}
          <span className="terminal-cursor ml-1 align-baseline" />
        </h1>
        <p className="max-w-xl text-sm text-c-muted" style={{ lineHeight: 1.6 }}>
          {summary}
        </p>
      </div>

      <div className="space-y-4 lg:col-span-4">
        {startDate ? (
          <EventEtaPanel
            slug={slug}
            startDate={startDate}
            endDate={endDate}
            timeZone={startTimezone}
            eventName={eventName}
          />
        ) : null}
        {eventId ? (
          <div className="lg:hidden">
            <CheckinAccessCard
              eventId={eventId}
              defaultOpen={isEventInProgress(startDate, endDate)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
