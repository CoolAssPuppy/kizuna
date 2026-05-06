import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { Button } from '@/components/ui/button';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { fetchUserMessages, loadCommunityPerson, loadCommunityProfile } from './api';
import { IdentityCard } from './person/IdentityCard';
import { loadEmployeeIdentity } from './person/loadEmployeeIdentity';
import { MessagesActivity, PhotosActivity } from './person/PersonActivity';
import { PersonHeader } from './person/PersonHeader';
import { useProfileActivityPhotos } from './photos/hooks';

export function CommunityPersonScreen(): JSX.Element {
  const { t } = useTranslation();
  const { userId = '' } = useParams<{ userId: string }>();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;

  const personQ = useQuery({
    queryKey: ['community', 'person', userId],
    queryFn: () => loadCommunityPerson(getSupabaseClient(), userId),
    enabled: !!userId,
  });
  const profileQ = useQuery({
    queryKey: ['community', 'profile', userId],
    queryFn: () => loadCommunityProfile(getSupabaseClient(), userId),
    enabled: !!userId,
  });
  const identityQ = useQuery({
    queryKey: ['community', 'identity', userId],
    queryFn: () => loadEmployeeIdentity(getSupabaseClient(), userId),
    enabled: !!userId,
  });
  const messagesQ = useQuery({
    queryKey: ['community', 'person-messages', userId],
    queryFn: () => fetchUserMessages(getSupabaseClient(), userId, 5),
    enabled: !!userId,
  });
  const photosQ = useProfileActivityPhotos(userId, eventId, 10);

  const person = personQ.data;
  const profile = profileQ.data;
  const identity = identityQ.data;
  const messages = messagesQ.data ?? [];
  const photos = photosQ.data ?? [];

  if (personQ.isLoading || profileQ.isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('app.loading')}
        </p>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <BackLink />
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('community.person.notFound')}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
      <BackLink />

      <header className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <PersonHeader person={person} identity={identity} />
        <IdentityCard identity={identity} />
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <section className="space-y-8 lg:col-span-8">
          {profile?.bio ? <StoryBlock label="bio" body={profile.bio} /> : null}
          {profile?.fun_fact ? <StoryBlock label="fun.fact" body={profile.fun_fact} /> : null}
          {profile && profile.hobbies.length > 0 ? (
            <section>
              <TerminalEyebrow label={`hobbies · ${profile.hobbies.length}`} />
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.hobbies.map((slug) => (
                  <li
                    key={slug}
                    className="border px-3 py-1.5 text-xs"
                    style={{ borderColor: 'var(--c-rule)', color: 'var(--c-fg)' }}
                  >
                    {slug.replace(/-/g, ' ')}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <PhotosActivity photos={photos} />
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <MessagesActivity messages={messages} />
        </aside>
      </div>
    </main>
  );
}

function BackLink(): JSX.Element {
  const { t } = useTranslation();
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link to="/community" className="inline-flex items-center gap-2">
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t('community.person.back')}
      </Link>
    </Button>
  );
}

function StoryBlock({ label, body }: { label: string; body: string }): JSX.Element {
  return (
    <section>
      <TerminalEyebrow label={label} />
      <p
        className="mt-3 whitespace-pre-line text-sm leading-relaxed"
        style={{ color: 'var(--c-fg)' }}
      >
        {body}
      </p>
    </section>
  );
}
