import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CardShell } from '@/components/CardShell';
import { useAuth } from '@/features/auth/AuthContext';
import { EventCountdown } from '@/features/events/EventCountdown';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { loadPersonalInfo } from '@/features/registration/api';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { useStorageImage } from '@/lib/useStorageImage';

import { CheckinAccessCard } from './CheckinAccessCard';
import { GREETINGS } from './greetings';
import { JetLagFighter } from './JetLagFighter';
import { TeammateIcebreaker } from './TeammateIcebreaker';
import { useEditorialFeed, type EditorialFeedItem } from './useEditorialFeed';
import { useEventStats } from './useEventStats';
import { useHomeFeed, type FeedItem } from './useHomeFeed';

export function HomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;

  const { data: feed } = useHomeFeed(eventId);
  const { data: stats } = useEventStats(eventId);
  const editorial = useEditorialFeed(eventId);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-8 py-10">
      <Greeting />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Priority block — first on mobile, top-right on desktop. */}
        <aside className="order-1 space-y-4 lg:order-none lg:col-span-2 lg:col-start-4 lg:row-start-1">
          {event ? <EventCountdown startsAt={event.start_date} size="sm" fullWidth /> : null}
          {event ? <CheckinAccessCard eventId={event.id} /> : null}
        </aside>

        {/* Feed — second on mobile, left column on desktop spanning both rows. */}
        <section className="order-2 space-y-4 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {editorial.main.length > 0 ? (
            <ul className="space-y-3">
              {editorial.main.map((item) => (
                <EditorialRow key={item.id} item={item} />
              ))}
            </ul>
          ) : null}

          {feed && feed.length > 0 ? (
            <ul className="space-y-3">
              {feed.map((item) => (
                <FeedRow key={item.id} item={item} />
              ))}
            </ul>
          ) : null}

          {editorial.main.length === 0 && (feed?.length ?? 0) === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {t('home.feedEmpty')}
            </p>
          ) : null}
        </section>

        {/* Everything else — last on mobile, below the priority block on desktop. */}
        <aside className="order-3 space-y-4 lg:order-none lg:col-span-2 lg:col-start-4 lg:row-start-2">
          <TeammateIcebreaker />
          {event ? <JetLagFighter eventTimeZone={event.time_zone} /> : null}
          <CardShell title={t('home.factsTitle')} description={t('home.factsSubtitle')}>
            <dl className="grid grid-cols-1 gap-4">
              <Fact label={t('home.facts.employees')} value={stats?.employeeCount ?? 0} />
              <Fact label={t('home.facts.guests')} value={stats?.guestCount ?? 0} />
              <Fact
                label={t('home.facts.registrationsStarted')}
                value={stats?.registrationsStarted ?? 0}
              />
              <Fact
                label={t('home.facts.registrationsComplete')}
                value={stats?.registrationsComplete ?? 0}
              />
              <Fact
                label={t('home.facts.documentsSigned')}
                value={stats?.documentsAcknowledged ?? 0}
              />
            </dl>
          </CardShell>

          {editorial.sidebar.map((item) => (
            <SidebarFeedCard key={item.id} item={item} />
          ))}
        </aside>
      </div>
    </main>
  );
}

function EditorialRow({ item }: { item: EditorialFeedItem }): JSX.Element {
  const imageUrl = useStorageImage('feed-images', item.image_path);
  const body = (
    <article className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="aspect-[3/1] w-full rounded-md object-cover" />
      ) : null}
      <h3 className="text-base font-semibold">{item.title}</h3>
      {item.subtitle ? <p className="text-sm text-muted-foreground">{item.subtitle}</p> : null}
      {item.body ? <p className="text-sm leading-relaxed">{item.body}</p> : null}
    </article>
  );
  return item.link_url ? (
    <li>
      <a href={item.link_url}>{body}</a>
    </li>
  ) : (
    <li>{body}</li>
  );
}

function SidebarFeedCard({ item }: { item: EditorialFeedItem }): JSX.Element {
  const imageUrl = useStorageImage('feed-images', item.image_path);
  return (
    <CardShell title={item.title} {...(item.subtitle ? { description: item.subtitle } : {})}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="aspect-[3/2] w-full rounded-md object-cover" />
      ) : null}
      {item.body ? <p className="pt-3 text-sm text-muted-foreground">{item.body}</p> : null}
    </CardShell>
  );
}

function Greeting(): JSX.Element {
  const { user } = useAuth();
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!, []);
  const { data: profile } = useQuery({
    queryKey: ['profile', 'personalInfo', user?.id],
    queryFn: () => loadPersonalInfo(getSupabaseClient(), user!.id),
    enabled: !!user,
  });
  const preferredName =
    profile?.preferred_name ?? (user ? (user.email.split('@')[0] ?? null) : null);

  return (
    <h1 className="text-4xl font-semibold tracking-tight">
      <span lang={greeting.lang.toLowerCase().slice(0, 2)}>{greeting.text}</span>
      {preferredName ? `, ${preferredName}.` : '.'}
    </h1>
  );
}

function FeedRow({ item }: { item: FeedItem }): JSX.Element {
  const { t } = useTranslation();

  const body = (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3 text-card-foreground transition-colors hover:bg-accent">
      <div className="flex flex-row items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`home.kinds.${item.kind}`)}
        </span>
        <span className="text-xs text-muted-foreground">
          {mediumDateFormatter.format(new Date(item.createdAt))}
        </span>
      </div>
      <h3 className="text-sm font-semibold capitalize">{item.title}</h3>
      <p className="text-sm text-muted-foreground">{item.detail}</p>
    </div>
  );

  return <li>{item.href ? <Link to={item.href}>{body}</Link> : body}</li>;
}

function Fact({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="flex flex-row items-baseline justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}
