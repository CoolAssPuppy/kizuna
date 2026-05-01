import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CardShell } from '@/components/CardShell';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { loadPersonalInfo } from '@/features/registration/api';
import { getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { useStorageImage } from '@/lib/useStorageImage';

import { GREETINGS } from './greetings';
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
  const dynamicCount = feed?.length ?? 0;
  const editorialCount = editorial.main.length;

  useRealtimeInvalidation([
    { table: 'feed_items', invalidates: ['home', 'editorial-feed'] },
    { table: 'registrations', invalidates: ['home', 'event-stats'] },
    { table: 'users', invalidates: ['home', 'event-stats'] },
    { table: 'document_acknowledgements', invalidates: ['home', 'event-stats'] },
    { table: 'notifications', invalidates: ['home', 'feed'] },
    { table: 'documents', invalidates: ['home', 'feed'] },
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-8 py-10">
      <Greeting />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">{t('home.feedTitle')}</h2>
            <span className="text-xs text-muted-foreground">
              {dynamicCount + editorialCount} {t('home.itemsLabel')}
            </span>
          </header>

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

          {editorialCount === 0 && dynamicCount === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {t('home.feedEmpty')}
            </p>
          ) : null}
        </section>

        <aside className="space-y-4 lg:col-span-2">
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
        <img
          src={imageUrl}
          alt=""
          className="aspect-[3/1] w-full rounded-md object-cover"
        />
      ) : null}
      <h3 className="text-base font-semibold">{item.title}</h3>
      {item.subtitle ? (
        <p className="text-sm text-muted-foreground">{item.subtitle}</p>
      ) : null}
      {item.body ? <p className="text-sm leading-relaxed">{item.body}</p> : null}
    </article>
  );
  return item.link_url ? <li><a href={item.link_url}>{body}</a></li> : <li>{body}</li>;
}

function SidebarFeedCard({ item }: { item: EditorialFeedItem }): JSX.Element {
  const imageUrl = useStorageImage('feed-images', item.image_path);
  return (
    <CardShell title={item.title} {...(item.subtitle ? { description: item.subtitle } : {})}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="aspect-[3/2] w-full rounded-md object-cover"
        />
      ) : null}
      {item.body ? <p className="pt-3 text-sm text-muted-foreground">{item.body}</p> : null}
    </CardShell>
  );
}

function Greeting(): JSX.Element {
  const { user } = useAuth();
  const [preferredName, setPreferredName] = useState<string | null>(null);
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const profile = await loadPersonalInfo(getSupabaseClient(), user.id);
      if (!active) return;
      setPreferredName(profile?.preferred_name ?? user.email.split('@')[0] ?? null);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <header>
      <h1 className="text-4xl font-semibold tracking-tight">
        <span lang={greeting.lang.toLowerCase().slice(0, 2)}>{greeting.text}</span>
        {preferredName ? `, ${preferredName}.` : '.'}
      </h1>
    </header>
  );
}

function FeedRow({ item }: { item: FeedItem }): JSX.Element {
  const { t } = useTranslation();
  const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

  const body = (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3 text-card-foreground transition-colors hover:bg-accent">
      <div className="flex flex-row items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`home.kinds.${item.kind}`)}
        </span>
        <span className="text-xs text-muted-foreground">
          {dateFmt.format(new Date(item.createdAt))}
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
