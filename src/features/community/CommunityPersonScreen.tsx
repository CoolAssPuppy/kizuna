import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, Calendar, Hash, MapPin, Users as UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { EmailField } from '@/components/EmailField';
import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { Button } from '@/components/ui/button';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';

import { COUNTRIES } from './countries';
import { fetchUserMessages, loadCommunityPerson, loadCommunityProfile } from './api';
import { useProfileActivityPhotos } from './photos/hooks';
import { type PhotoRecord } from './photos/api';
import { PHOTOS_BUCKET } from './photos/api';
import { useStorageImage } from '@/lib/useStorageImage';

interface EmployeeIdentity {
  user_id: string;
  department: string | null;
  team: string | null;
  job_title: string | null;
  start_date: string | null;
  base_city: string | null;
  years_attended: number;
  manager: { user_id: string; first_name: string | null; last_name: string | null } | null;
}

async function loadEmployeeIdentity(
  client: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<EmployeeIdentity | null> {
  const { data, error } = await client
    .from('employee_profiles')
    .select(
      `
      user_id, department, team, job_title, start_date, base_city, years_attended
    `,
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    user_id: data.user_id,
    department: data.department,
    team: data.team,
    job_title: data.job_title,
    start_date: data.start_date,
    base_city: data.base_city,
    years_attended: data.years_attended,
    manager: null,
  };
}

function countryName(code: string | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper)?.name ?? upper;
}

function locationLabel(city: string | null, country: string | null): string | null {
  const c = countryName(country);
  if (city && c) return `${city}, ${c}`;
  return city ?? c;
}

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
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('app.loading')}
        </p>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-10">
        <BackLink />
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('community.person.notFound')}
        </p>
      </main>
    );
  }

  const fullName = `${person.first_name} ${person.last_name}`.trim() || person.email;
  const initials = `${person.first_name.charAt(0)}${person.last_name.charAt(0)}` || '?';
  const hometown = locationLabel(person.hometown_city, person.hometown_country);
  const current = locationLabel(person.current_city, person.current_country);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-10 sm:px-8">
      <BackLink />

      <header className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div
          className="border p-8 lg:col-span-8"
          style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
        >
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <Avatar url={person.avatar_url} fallback={initials} size={128} />
            <div className="flex-1 space-y-4">
              <div>
                <TerminalEyebrow label="// session.profile" />
                <h1
                  className="mt-2 text-4xl font-semibold tracking-tight"
                  style={{ color: 'var(--c-fg)', letterSpacing: '-0.02em' }}
                >
                  {fullName}
                </h1>
                {identity?.job_title ? (
                  <p className="mt-1 text-sm" style={{ color: 'var(--c-muted)' }}>
                    {identity.job_title}
                    {identity.team ? ` · ${identity.team}` : ''}
                  </p>
                ) : null}
                <div className="mt-3">
                  <EmailField email={person.email} textClassName="text-c-muted text-sm" />
                </div>
              </div>
              {(hometown || current) && (
                <ul className="space-y-1 text-sm" style={{ color: 'var(--c-muted)' }}>
                  {hometown && (
                    <li className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {t('community.person.fromLabel', { value: hometown })}
                    </li>
                  )}
                  {current && current !== hometown && (
                    <li className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {t('community.person.nowLabel', { value: current })}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

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

function IdentityCard({
  identity,
}: {
  identity: EmployeeIdentity | null | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <aside
      className="border p-6 lg:col-span-4"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <TerminalEyebrow label="identity" />
      <dl className="mt-3 space-y-2 text-sm">
        <IdentityRow
          icon={<Briefcase className="h-3.5 w-3.5" aria-hidden />}
          label={t('community.person.identity.department')}
          value={identity?.department ?? null}
        />
        <IdentityRow
          icon={<UsersIcon className="h-3.5 w-3.5" aria-hidden />}
          label={t('community.person.identity.team')}
          value={identity?.team ?? null}
        />
        <IdentityRow
          icon={<Briefcase className="h-3.5 w-3.5" aria-hidden />}
          label={t('community.person.identity.title')}
          value={identity?.job_title ?? null}
        />
        <IdentityRow
          icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
          label={t('community.person.identity.baseCity')}
          value={identity?.base_city ?? null}
        />
        <IdentityRow
          icon={<Calendar className="h-3.5 w-3.5" aria-hidden />}
          label={t('community.person.identity.startDate')}
          value={
            identity?.start_date ? mediumDateFormatter.format(new Date(identity.start_date)) : null
          }
        />
        <IdentityRow
          icon={<Hash className="h-3.5 w-3.5" aria-hidden />}
          label={t('community.person.identity.yearsAttended')}
          value={
            identity?.years_attended != null && identity.years_attended > 0
              ? String(identity.years_attended)
              : null
          }
        />
      </dl>
    </aside>
  );
}

function IdentityRow({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string | null;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2" style={{ color: 'var(--c-muted)' }}>
        {icon}
        {label}
      </dt>
      <dd style={{ color: value ? 'var(--c-fg)' : 'var(--c-dim)' }}>{value ?? '—'}</dd>
    </div>
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

function MessagesActivity({
  messages,
}: {
  messages: ReadonlyArray<{ id: string; channel: string; body: string; sent_at: string }>;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (messages.length === 0) return null;
  return (
    <section
      className="border p-6"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <TerminalEyebrow label="recent.messages" />
      <ul className="mt-3 space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className="border-b pb-3 last:border-0 last:pb-0"
            style={{ borderColor: 'var(--c-rule)' }}
          >
            <Link to={`/community/channels/${m.channel}`} className="block hover:opacity-80">
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>
                #{m.channel} · {new Date(m.sent_at).toLocaleDateString()}
              </p>
              <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--c-fg)' }}>
                {m.body}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs" style={{ color: 'var(--c-muted)' }}>
        {t('community.person.activity.messagesHint')}
      </p>
    </section>
  );
}

function PhotosActivity({ photos }: { photos: ReadonlyArray<PhotoRecord> }): JSX.Element | null {
  const { t } = useTranslation();
  if (photos.length === 0) return null;
  return (
    <section>
      <TerminalEyebrow
        label={`photos · ${photos.length}`}
        trailing={t('community.person.activity.photosTrailing')}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {photos.map((photo) => (
          <PhotoActivityTile key={photo.id} photo={photo} />
        ))}
      </div>
    </section>
  );
}

function PhotoActivityTile({ photo }: { photo: PhotoRecord }): JSX.Element {
  const url = useStorageImage(PHOTOS_BUCKET, `${photo.storage_prefix}/thumb.webp`);
  return (
    <Link
      to={`/community/photos/${photo.id}`}
      className="block aspect-square overflow-hidden border"
      style={{ borderColor: 'var(--c-rule)', backgroundColor: 'var(--c-surface)' }}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}
    </Link>
  );
}
