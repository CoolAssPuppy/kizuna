import { Briefcase, Calendar, Hash, MapPin, Users as UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { mediumDateFormatter } from '@/lib/formatters';

import type { EmployeeIdentity } from './loadEmployeeIdentity';

/**
 * Right-rail employee identity card. Renders the structured profile
 * fields (department, team, role, base city, start date, years
 * attended) as a compact dl. Null fields show an em-dash so the row
 * heights stay even and the muted "—" reads as "missing" without
 * explicit copy.
 */
export function IdentityCard({
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
