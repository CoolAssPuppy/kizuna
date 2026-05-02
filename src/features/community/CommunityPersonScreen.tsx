import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { EmailField } from '@/components/EmailField';
import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { getSupabaseClient } from '@/lib/supabase';

import { COUNTRIES } from './countries';
import { loadCommunityPerson, loadCommunityProfile } from './api';

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

  const person = personQ.data;
  const profile = profileQ.data;

  if (personQ.isLoading || profileQ.isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-10">
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('app.loading')}
        </p>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-10">
        <Link
          to="/community"
          className="mb-6 inline-flex items-center gap-2 text-sm"
          style={{ color: 'var(--c-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" /> {t('community.person.back')}
        </Link>
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
  const moved = hometown && current && hometown !== current;
  const hobbies = profile?.hobbies ?? person.hobbies;

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
        <Link to="/community" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('community.person.back')}
        </Link>
      </Button>

      <header className="flex items-start gap-6">
        <Avatar url={person.avatar_url} fallback={initials} size={96} />
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--c-fg)' }}>
              {fullName}
            </h1>
            <EmailField
              email={person.email}
              className="mt-2 text-sm"
              textClassName="text-c-muted"
            />
          </div>
          {(hometown || current) && (
            <div className="space-y-1 text-sm" style={{ color: 'var(--c-muted)' }}>
              {hometown && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {moved ? t('community.person.fromLabel', { value: hometown }) : hometown}
                </p>
              )}
              {moved && current && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {t('community.person.nowLabel', { value: current })}
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      {profile?.bio ? (
        <section className="mt-10">
          <TerminalEyebrow label="bio" />
          <p
            className="mt-3 whitespace-pre-line text-sm leading-relaxed"
            style={{ color: 'var(--c-fg)' }}
          >
            {profile.bio}
          </p>
        </section>
      ) : null}

      {profile?.fun_fact ? (
        <section className="mt-10">
          <TerminalEyebrow label="fun.fact" />
          <p
            className="mt-3 whitespace-pre-line text-sm leading-relaxed"
            style={{ color: 'var(--c-fg)' }}
          >
            {profile.fun_fact}
          </p>
        </section>
      ) : null}

      {hobbies.length > 0 ? (
        <section className="mt-10">
          <TerminalEyebrow label={`hobbies · ${hobbies.length}`} />
          <ul className="mt-3 flex flex-wrap gap-2">
            {hobbies.map((slug) => (
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
    </main>
  );
}
