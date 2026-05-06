import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { EmailField } from '@/components/EmailField';
import { TerminalEyebrow } from '@/components/TerminalEyebrow';

import { COUNTRIES } from '@/lib/countries';

import type { EmployeeIdentity } from './loadEmployeeIdentity';

interface PersonRow {
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  hometown_city: string | null;
  hometown_country: string | null;
  current_city: string | null;
  current_country: string | null;
}

interface PersonHeaderProps {
  person: PersonRow;
  identity: EmployeeIdentity | null | undefined;
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

/**
 * Top hero panel for a community person. Mixes identity fields the
 * person edited themselves (avatar, hometown, current city) with the
 * employee_profiles row pulled from HiBob (job title, team). Guests
 * and dependents have no identity row, so the title line just renders
 * empty in that branch.
 */
export function PersonHeader({ person, identity }: PersonHeaderProps): JSX.Element {
  const { t } = useTranslation();
  const fullName = `${person.first_name} ${person.last_name}`.trim() || person.email;
  const initials = `${person.first_name.charAt(0)}${person.last_name.charAt(0)}` || '?';
  const hometown = locationLabel(person.hometown_city, person.hometown_country);
  const current = locationLabel(person.current_city, person.current_country);

  return (
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
  );
}
