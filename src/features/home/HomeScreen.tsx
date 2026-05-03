import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { StatusDot } from '@/components/StatusDot';
import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { loadPersonalInfo } from '@/features/registration/api';
import { useMountEffect } from '@/hooks/useMountEffect';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { CheckinAccessCard } from './CheckinAccessCard';
import { HomeMemoriesSection } from './HomeMemoriesSection';
import { JetLagFighter } from './JetLagFighter';
import { TeammateIcebreaker } from './TeammateIcebreaker';
import { useEditorialFeed, type EditorialFeedItem } from './useEditorialFeed';
import { useEventStats, type EventStats } from './useEventStats';
import { useHomeFeed, type FeedItem } from './useHomeFeed';

const KIND_LABELS: Record<FeedItem['kind'], string> = {
  document: 'document',
  task: 'registration',
  announcement: 'announcement',
};

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isLive: boolean;
}

function diffToCountdown(target: Date): Countdown {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, isLive: true };
  const total = Math.floor(ms / 60_000);
  return {
    days: Math.floor(total / (60 * 24)),
    hours: Math.floor((total / 60) % 24),
    minutes: total % 60,
    isLive: false,
  };
}

/**
 * 1-based day of the event when in progress; null otherwise. Day 1 is
 * the calendar day that contains startDate. Boundaries use the event
 * timezone so a 9pm-local start still rolls to Day 2 the next morning,
 * not at UTC midnight.
 */
function dayOfEvent(
  startDate: string,
  endDate: string,
  timeZone: string,
  now: Date = new Date(),
): number | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (now < start || now > end) return null;
  const dayInTz = (d: Date): string =>
    d.toLocaleDateString('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const startKey = dayInTz(start);
  const nowKey = dayInTz(now);
  const startMidnight = new Date(`${startKey}T00:00:00Z`).getTime();
  const nowMidnight = new Date(`${nowKey}T00:00:00Z`).getTime();
  const dayIndex = Math.floor((nowMidnight - startMidnight) / (1000 * 60 * 60 * 24));
  return dayIndex + 1;
}

function eventSlug(
  name: string | null | undefined,
  location: string | null | undefined,
  startDate: string | null | undefined,
): string {
  const base = (location ?? name ?? 'event').toLowerCase().trim();
  const slug = base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const year = startDate ? new Date(startDate).getUTCFullYear() : new Date().getUTCFullYear();
  return `${slug}_${year}`;
}

function snakeFile(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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
          <Queue feed={feed} editorial={editorial.main} count={queueCount} />
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

function isEventInProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  if (!startDate || !endDate) return false;
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
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

interface EventEtaPanelProps {
  slug: string;
  startDate: string;
  endDate: string | null;
  timeZone: string;
  eventName: string | null;
}

function EventEtaPanel({
  slug,
  startDate,
  endDate,
  timeZone,
  eventName,
}: EventEtaPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [now, setNow] = useState<Date>(() => new Date());

  useMountEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  });

  const countdown = diffToCountdown(new Date(startDate));
  const day = endDate ? dayOfEvent(startDate, endDate, timeZone, now) : null;
  // Stable rotation through the tip pool so attendees know what to expect
  // each morning. Uses tip count from i18n.
  const tipCount = Number.parseInt(t('home.terminal.dayTips.count'), 10) || 0;
  const tipKey = day !== null && tipCount > 0 ? `home.terminal.dayTips.t${((day - 1) % tipCount) + 1}` : null;

  const startLabel = new Date(startDate).toLocaleString('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    hourCycle: 'h23',
  });

  return (
    <div className="border border-c-rule bg-c-surface p-6">
      <TerminalEyebrow
        as="h2"
        label={`ETA · ${slug.toUpperCase()}`}
        trailing={
          <span className="text-c-accent" aria-hidden>
            ●
          </span>
        }
      />
      {day !== null ? (
        <div className="mt-4 space-y-3">
          <p
            className="text-3xl font-extralight text-c-accent"
            style={{ letterSpacing: '-0.04em' }}
          >
            {t('home.terminal.dayHeading', { day })}
          </p>
          {tipKey ? (
            <p className="text-sm text-c-muted" style={{ lineHeight: 1.5 }}>
              {t(tipKey)}
            </p>
          ) : null}
        </div>
      ) : countdown.isLive ? (
        <div
          className="mt-4 text-3xl font-extralight text-c-accent"
          style={{ letterSpacing: '-0.04em' }}
        >
          {eventName ?? t('home.terminal.nowLive')}
        </div>
      ) : (
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <EtaCell value={countdown.days} unit="d" emphasize />
          <EtaCell value={countdown.hours} unit="h" />
          <EtaCell value={countdown.minutes} unit="m" />
        </div>
      )}
      <div className="my-4 h-px bg-c-rule" />
      <dl className="space-y-1 text-[11px]">
        <EtaRow label={t('home.terminal.startLabel')} value={startLabel} highlight />
        <EtaRow label={t('home.terminal.timezoneLabel')} value={timeZone} />
      </dl>
    </div>
  );
}

function EtaCell({
  value,
  unit,
  emphasize = false,
}: {
  value: number;
  unit: string;
  emphasize?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn('font-extralight', emphasize ? 'text-c-accent' : 'text-c-fg')}
        style={{
          fontSize: emphasize ? 56 : 32,
          letterSpacing: emphasize ? '-0.04em' : undefined,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span className="text-xs text-c-dim">{unit}</span>
    </div>
  );
}

function EtaRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
      <dt className="text-c-muted">{label}</dt>
      <dd className={cn('break-words text-right', highlight ? 'text-c-accent' : 'text-c-fg')}>
        {value}
      </dd>
    </div>
  );
}

interface QueueProps {
  feed: ReadonlyArray<FeedItem>;
  editorial: ReadonlyArray<EditorialFeedItem>;
  count: number;
}

function Queue({ feed, editorial, count }: QueueProps): JSX.Element {
  const { t } = useTranslation();
  if (count === 0) {
    return (
      <div>
        <TerminalEyebrow as="h2" label={t('home.terminal.queueLabel', { count: 0 })} ruled />
        <p className="py-12 text-center text-sm text-c-muted">{t('home.feedEmpty')}</p>
      </div>
    );
  }

  let index = 0;
  return (
    <div>
      <TerminalEyebrow
        as="h2"
        label={t('home.terminal.queueLabel', { count })}
        trailing={t('home.terminal.queueSort')}
        ruled
      />
      <ol className="divide-y border-c-rule">
        {editorial.map((item) => {
          index += 1;
          return <EditorialQueueRow key={item.id} item={item} index={index} />;
        })}
        {feed.map((item) => {
          index += 1;
          return <FeedQueueRow key={item.id} item={item} index={index} />;
        })}
      </ol>
    </div>
  );
}

function FeedQueueRow({ item, index }: { item: FeedItem; index: number }): JSX.Element {
  const { t } = useTranslation();
  const created = new Date(item.createdAt);
  const dateLabel = created.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const metaLabel = item.kind === 'document' ? 'due' : item.kind === 'task' ? 'progress' : 'posted';

  const body = (
    <div className="grid grid-cols-[2rem_1fr] items-start gap-x-3 gap-y-2 border-c-rule py-5 sm:grid-cols-[3rem_8rem_1fr_8rem] sm:gap-5">
      <span className="text-[11px] text-c-dim">[{String(index).padStart(2, '0')}]</span>
      <span
        className="text-[11px] font-bold uppercase text-c-accent"
        style={{ letterSpacing: '0.12em' }}
      >
        {KIND_LABELS[item.kind]}
      </span>
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
        <span className="break-words text-base font-medium text-c-fg">
          {snakeFile(item.title)}
        </span>
        <span className="break-words text-xs text-c-muted" style={{ lineHeight: 1.5 }}>
          {item.detail}
        </span>
      </div>
      <div className="col-span-2 flex flex-row items-baseline gap-2 text-[11px] sm:col-span-1 sm:w-32 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
        <span className="text-c-dim">{metaLabel}</span>
        <span className="text-c-fg">{dateLabel}</span>
      </div>
    </div>
  );

  return (
    <li>
      {item.href ? (
        <Link to={item.href} className="block transition-colors hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
      <span className="sr-only">
        {t(`home.kinds.${item.kind}`)} — {item.detail}
      </span>
    </li>
  );
}

function EditorialQueueRow({
  item,
  index,
}: {
  item: EditorialFeedItem;
  index: number;
}): JSX.Element {
  const body = (
    <div className="grid grid-cols-[2rem_1fr] items-start gap-x-3 gap-y-2 border-c-rule py-5 sm:grid-cols-[3rem_8rem_1fr_8rem] sm:gap-5">
      <span className="text-[11px] text-c-dim">[{String(index).padStart(2, '0')}]</span>
      <span
        className="text-[11px] font-bold uppercase text-c-accent"
        style={{ letterSpacing: '0.12em' }}
      >
        feature
      </span>
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
        <span className="break-words text-base font-medium text-c-fg">{item.title}</span>
        {item.subtitle ? (
          <span className="break-words text-xs text-c-muted" style={{ lineHeight: 1.5 }}>
            {item.subtitle}
          </span>
        ) : null}
        {item.body ? (
          <span className="break-words text-xs text-c-muted" style={{ lineHeight: 1.5 }}>
            {item.body}
          </span>
        ) : null}
      </div>
      <div className="hidden sm:block" />
    </div>
  );

  return (
    <li>
      {item.link_url ? (
        <a href={item.link_url} className="block transition-colors hover:opacity-80">
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}

function EventStatsPanel({ stats }: { stats: EventStats | undefined }): JSX.Element {
  const { t } = useTranslation();
  const rows = [
    {
      label: t('home.terminal.stats.employees'),
      value: stats?.employeeCount ?? 0,
      highlight: false,
    },
    {
      label: t('home.terminal.stats.guests'),
      value: stats?.guestCount ?? 0,
      highlight: false,
    },
    {
      label: t('home.terminal.stats.registrationsStarted'),
      value: stats?.registrationsStarted ?? 0,
      highlight: false,
    },
    {
      label: t('home.terminal.stats.registrationsComplete'),
      value: stats?.registrationsComplete ?? 0,
      highlight: true,
    },
    {
      label: t('home.terminal.stats.documentsSigned'),
      value: stats?.documentsAcknowledged ?? 0,
      highlight: true,
    },
  ];
  return (
    <div className="border border-c-rule bg-c-surface p-5">
      <TerminalEyebrow
        as="h2"
        label={t('home.terminal.statsLabel')}
        trailing={t('home.terminal.live')}
      />
      <dl className="mt-3 space-y-0">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between py-1.5 text-xs">
            <dt className="text-c-muted">{row.label}</dt>
            <dd className={cn('text-[13px]', row.highlight ? 'text-c-accent' : 'text-c-fg')}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SidebarEditorialCard({ item }: { item: EditorialFeedItem }): JSX.Element {
  const { t } = useTranslation();
  return (
    <article className="border border-c-rule bg-c-surface p-5">
      <TerminalEyebrow label={t('home.terminal.feedItemLabel')} />
      <h2 className="mt-3 text-sm font-medium text-c-fg">{item.title}</h2>
      {item.subtitle ? <p className="mt-1 text-xs text-c-muted">{item.subtitle}</p> : null}
      {item.body ? <p className="mt-2 text-xs leading-relaxed text-c-muted">{item.body}</p> : null}
    </article>
  );
}
