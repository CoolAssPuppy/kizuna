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

/**
 * Pill badge for a user role. Used on the Profile header and the admin
 * Reports table; both render with the same secondary-badge styling so a
 * "guest" tag in the report visually matches the one on a profile.
 */
export function RolePill({ role }: Props): JSX.Element {
  const { t } = useTranslation();
  const label = isAppRole(role) ? t(`roles.${role}`) : sentenceCase(role);
  return (
    <span className="inline-flex items-center rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {label}
    </span>
  );
}
