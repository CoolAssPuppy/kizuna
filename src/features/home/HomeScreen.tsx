import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CommandPaletteBar } from '@/components/CommandPaletteBar';
import { StatusDot } from '@/components/StatusDot';
import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { loadPersonalInfo } from '@/features/registration/api';
import { useMountEffect } from '@/hooks/useMountEffect';
import { getSupabaseClient } from '@/lib/supabase';

import { CheckinAccessCard } from './CheckinAccessCard';
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

function eventSlug(name: string | null | undefined, location: string | null | undefined, startDate: string | null | undefined): string {
  const base = (location ?? name ?? 'event').toLowerCase().trim();
  const slug = base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const year = startDate ? new Date(startDate).getUTCFullYear() : new Date().getUTCFullYear();
  return `${slug}_${year}`;
}

function snakeFile(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9.]+/g, '_').replace(/^_+|_+$/g, '');
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
  const summary =
    queueCount === 0
      ? t('home.terminal.summaryEmpty')
      : t('home.terminal.summary', { count: queueCount });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-10 pb-12 sm:px-8">
      <Hero
        preferredName={preferredName}
        summary={summary}
        eventSlug={slug}
        eventName={event?.name ?? null}
        startDate={event?.start_date ?? null}
        startTimezone={event?.time_zone ?? 'UTC'}
      />

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <Queue feed={feed} editorial={editorial.main} count={queueCount} />
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <EventStatsPanel stats={stats} />
          {event ? <JetLagFighter eventTimeZone={event.time_zone} /> : null}
          <TeammateIcebreaker />
          {event ? <CheckinAccessCard eventId={event.id} /> : null}
          {editorial.sidebar.map((item) => (
            <SidebarEditorialCard key={item.id} item={item} />
          ))}
          <CommandPaletteBar />
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
  startTimezone: string;
}

function Hero({
  preferredName,
  summary,
  eventSlug: slug,
  eventName,
  startDate,
  startTimezone,
}: HeroProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="space-y-5 lg:col-span-8">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--c-dim)' }}>
          <span>// session active</span>
          <StatusDot active size={6} />
          <span style={{ color: 'var(--c-accent)', letterSpacing: '0.04em' }}>
            {t('home.terminal.connected')}
          </span>
        </div>
        <h1
          className="font-extralight"
          style={{
            color: 'var(--c-fg)',
            fontSize: 'clamp(40px, 8vw, 72px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: 'var(--c-fg)' }}>&gt; {t('home.terminal.greeting')},</span>
          <br />
          {preferredName ?? t('home.terminal.fallbackName')}
          <span className="terminal-cursor align-baseline ml-1" />
        </h1>
        <p className="max-w-xl text-sm" style={{ color: 'var(--c-muted)', lineHeight: 1.6 }}>
          {summary}
        </p>
      </div>

      <div className="lg:col-span-4">
        {startDate ? (
          <EventEtaPanel
            slug={slug}
            startDate={startDate}
            timeZone={startTimezone}
            eventName={eventName}
          />
        ) : null}
      </div>
    </section>
  );
}

interface EventEtaPanelProps {
  slug: string;
  startDate: string;
  timeZone: string;
  eventName: string | null;
}

function EventEtaPanel({
  slug,
  startDate,
  timeZone,
  eventName,
}: EventEtaPanelProps): JSX.Element {
  const [countdown, setCountdown] = useState<Countdown>(() =>
    diffToCountdown(new Date(startDate)),
  );

  useMountEffect(() => {
    const target = new Date(startDate);
    const id = window.setInterval(() => setCountdown(diffToCountdown(target)), 60_000);
    return () => window.clearInterval(id);
  });

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
    <div
      className="border p-6"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <TerminalEyebrow
        label={`ETA · ${slug.toUpperCase()}`}
        trailing={
          <span style={{ color: 'var(--c-accent)' }} aria-hidden>
            ●
          </span>
        }
      />
      {countdown.isLive ? (
        <div
          className="mt-4 text-3xl font-extralight"
          style={{ color: 'var(--c-accent)', letterSpacing: '-0.04em' }}
        >
          {eventName ?? 'Now live'}
        </div>
      ) : (
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <EtaCell value={countdown.days} unit="d" emphasize />
          <EtaCell value={countdown.hours} unit="h" />
          <EtaCell value={countdown.minutes} unit="m" />
        </div>
      )}
      <div className="my-4 h-px" style={{ backgroundColor: 'var(--c-rule)' }} />
      <dl className="space-y-1 text-[11px]">
        <EtaRow label="event.start" value={startLabel} highlight />
        <EtaRow label="event.timezone" value={timeZone} />
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
        className="font-extralight"
        style={{
          color: emphasize ? 'var(--c-accent)' : 'var(--c-fg)',
          fontSize: emphasize ? 56 : 32,
          letterSpacing: emphasize ? '-0.04em' : undefined,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--c-dim)' }}>
        {unit}
      </span>
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
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--c-muted)' }}>{label}</dt>
      <dd style={{ color: highlight ? 'var(--c-accent)' : 'var(--c-fg)' }}>{value}</dd>
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
        <TerminalEyebrow label={t('home.terminal.queueLabel', { count: 0 })} ruled />
        <p className="py-12 text-center text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('home.feedEmpty')}
        </p>
      </div>
    );
  }

  let index = 0;
  return (
    <div>
      <TerminalEyebrow
        label={t('home.terminal.queueLabel', { count })}
        trailing={t('home.terminal.queueSort')}
        ruled
      />
      <ol className="divide-y" style={{ borderColor: 'var(--c-rule)' }}>
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
  const meta = (
    <div className="flex w-32 shrink-0 flex-col items-end gap-1 text-[11px]">
      <span style={{ color: 'var(--c-dim)' }}>
        {item.kind === 'document' ? 'due' : item.kind === 'task' ? 'progress' : 'posted'}
      </span>
      <span style={{ color: 'var(--c-fg)' }}>{dateLabel}</span>
    </div>
  );

  const body = (
    <div
      className="grid grid-cols-[3rem_8rem_1fr_8rem] items-start gap-5 py-5"
      style={{ borderColor: 'var(--c-rule)' }}
    >
      <span className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        [{String(index).padStart(2, '0')}]
      </span>
      <span
        className="text-[11px] font-bold uppercase"
        style={{ color: 'var(--c-accent)', letterSpacing: '0.12em' }}
      >
        {KIND_LABELS[item.kind]}
      </span>
      <div className="flex flex-col gap-1.5">
        <span
          className="text-base font-medium"
          style={{ color: 'var(--c-fg)' }}
        >
          {snakeFile(item.title)}
        </span>
        <span className="text-xs" style={{ color: 'var(--c-muted)', lineHeight: 1.5 }}>
          {item.detail}
        </span>
      </div>
      {meta}
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
    <div
      className="grid grid-cols-[3rem_8rem_1fr_8rem] items-start gap-5 py-5"
      style={{ borderColor: 'var(--c-rule)' }}
    >
      <span className="text-[11px]" style={{ color: 'var(--c-dim)' }}>
        [{String(index).padStart(2, '0')}]
      </span>
      <span
        className="text-[11px] font-bold uppercase"
        style={{ color: 'var(--c-accent)', letterSpacing: '0.12em' }}
      >
        feature
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium" style={{ color: 'var(--c-fg)' }}>
          {item.title}
        </span>
        {item.subtitle ? (
          <span className="text-xs" style={{ color: 'var(--c-muted)', lineHeight: 1.5 }}>
            {item.subtitle}
          </span>
        ) : null}
        {item.body ? (
          <span className="text-xs" style={{ color: 'var(--c-muted)', lineHeight: 1.5 }}>
            {item.body}
          </span>
        ) : null}
      </div>
      <div />
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
    { label: 'attendees.employees', value: stats?.employeeCount ?? 0, highlight: false },
    { label: 'attendees.guests', value: stats?.guestCount ?? 0, highlight: false },
    {
      label: 'registrations.in_progress',
      value: stats?.registrationsStarted ?? 0,
      highlight: false,
    },
    {
      label: 'registrations.complete',
      value: stats?.registrationsComplete ?? 0,
      highlight: true,
    },
    { label: 'documents.signed', value: stats?.documentsAcknowledged ?? 0, highlight: true },
  ];
  return (
    <div
      className="border p-5"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <TerminalEyebrow label="event.stats" trailing={t('home.terminal.live')} />
      <dl className="mt-3 space-y-0">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between py-1.5 text-xs">
            <dt style={{ color: 'var(--c-muted)' }}>{row.label}</dt>
            <dd
              className="text-[13px]"
              style={{ color: row.highlight ? 'var(--c-accent)' : 'var(--c-fg)' }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SidebarEditorialCard({ item }: { item: EditorialFeedItem }): JSX.Element {
  return (
    <article
      className="border p-5"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <TerminalEyebrow label="feed.item" />
      <h3 className="mt-3 text-sm font-medium" style={{ color: 'var(--c-fg)' }}>
        {item.title}
      </h3>
      {item.subtitle ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--c-muted)' }}>
          {item.subtitle}
        </p>
      ) : null}
      {item.body ? (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          {item.body}
        </p>
      ) : null}
    </article>
  );
}
