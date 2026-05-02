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
import { STORAGE_BUCKETS } from '@/lib/storageBuckets';
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
  const heroImage = useStorageImage(STORAGE_BUCKETS.eventContent, event?.hero_image_path ?? null);

  return (
    <main className="space-y-10 pb-10">
      <HeroBand imageUrl={heroImage} />

      <div className="mx-auto w-full max-w-7xl space-y-10 px-8">
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
      </div>
    </main>
  );
}

function EditorialRow({ item }: { item: EditorialFeedItem }): JSX.Element {
  const imageUrl = useStorageImage(STORAGE_BUCKETS.eventContent, item.image_path);
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
  const imageUrl = useStorageImage(STORAGE_BUCKETS.eventContent, item.image_path);
  return (
    <CardShell title={item.title} {...(item.subtitle ? { description: item.subtitle } : {})}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="aspect-[3/2] w-full rounded-md object-cover" />
      ) : null}
      {item.body ? <p className="pt-3 text-sm text-muted-foreground">{item.body}</p> : null}
    </CardShell>
  );
}

/**
 * Full-bleed hero band that crowns the home screen. The greeting is
 * laid OVER the cover image — a top-to-bottom darkening gradient
 * keeps the headline legible regardless of the photograph the admin
 * uploaded. When no image is set yet, a brand gradient fills in so
 * the band still has presence (and the greeting still reads dark on
 * a soft surface).
 */
function HeroBand({ imageUrl }: { imageUrl: string | null }): JSX.Element {
  const hasImage = !!imageUrl;
  return (
    <section className="relative h-[260px] w-full overflow-hidden md:h-[340px]">
      {hasImage ? (
        <img
          src={imageUrl ?? undefined}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background" />
      )}
      {hasImage ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
        />
      ) : null}
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-7xl px-8 pb-8 md:pb-10">
          <Greeting tone={hasImage ? 'overlay' : 'default'} />
        </div>
      </div>
    </section>
  );
}

function Greeting({ tone }: { tone: 'overlay' | 'default' }): JSX.Element {
  const { user } = useAuth();
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!, []);
  const { data: profile } = useQuery({
    queryKey: ['profile', 'personalInfo', user?.id],
    queryFn: () => loadPersonalInfo(getSupabaseClient(), user!.id),
    enabled: !!user,
  });
  const preferredName =
    profile?.preferred_name ?? (user ? (user.email.split('@')[0] ?? null) : null);

  const className =
    tone === 'overlay'
      ? 'text-4xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] md:text-5xl'
      : 'text-4xl font-semibold tracking-tight';

  return (
    <h1 className={className}>
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
