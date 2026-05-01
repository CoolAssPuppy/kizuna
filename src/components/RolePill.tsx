import { useTranslation } from 'react-i18next';

import type { AppRole } from '@/features/auth/types';

const KNOWN_ROLES: ReadonlyArray<AppRole> = ['super_admin', 'admin', 'employee', 'guest'];

interface Props {
  /** Accepts AppRole values plus arbitrary strings from raw API payloads. */
  role: string;
}

function isAppRole(role: string): role is AppRole {
  return (KNOWN_ROLES as ReadonlyArray<string>).includes(role);
}

function sentenceCase(value: string): string {
  if (!value) return '';
  const flat = value.replace(/_/g, ' ').toLowerCase();
  return flat.charAt(0).toUpperCase() + flat.slice(1);
}

const PILL_BASE = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium';

/**
 * Pill badge for a user role. Used on the Profile header and the admin
 * Reports table; both render with the same secondary-badge styling so a
 * "guest" tag in the report visually matches the one on a profile.
 */
export function RolePill({ role }: Props): JSX.Element {
  const { t } = useTranslation();
  const label = isAppRole(role) ? t(`roles.${role}`) : sentenceCase(role);
  return <span className={`${PILL_BASE} bg-secondary text-secondary-foreground`}>{label}</span>;
}

/**
 * Companion pill for the leadership flag. Rendered next to the role pill
 * (Profile header, admin reports) for any user with is_leadership=true.
 * Visually distinct from the role tag so a quick scan of a list separates
 * roles from leadership at a glance.
 */
export function LeadershipPill(): JSX.Element {
  const { t } = useTranslation();
  return (
    <span className={`${PILL_BASE} border-primary/30 bg-primary/10 text-primary`}>
      {t('roles.leadership')}
    </span>
  );
}
