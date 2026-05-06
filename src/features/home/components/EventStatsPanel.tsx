import { useTranslation } from 'react-i18next';

import { TerminalEyebrow } from '@/components/terminal/TerminalEyebrow';
import { cn } from '@/lib/utils';

import type { EventStats } from '../useEventStats';

/**
 * Sidebar stats card on the home screen. Reads from useEventStats and
 * renders five rows; the last two (registrations complete, documents
 * signed) get the accent color because they're the milestones we want
 * attendees thinking about.
 */
export function EventStatsPanel({ stats }: { stats: EventStats | undefined }): JSX.Element {
  const { t } = useTranslation();
  const rows = [
    {
      label: t('home.terminal.stats.employees'),
      value: stats?.employeeCount ?? 0,
      highlight: false,
    },
    {
      label: t('home.terminal.stats.guests'),
      value: stats?.guestCount ?? 0,
      highlight: false,
    },
    {
      label: t('home.terminal.stats.registrationsStarted'),
      value: stats?.registrationsStarted ?? 0,
      highlight: false,
    },
    {
      label: t('home.terminal.stats.registrationsComplete'),
      value: stats?.registrationsComplete ?? 0,
      highlight: true,
    },
    {
      label: t('home.terminal.stats.documentsSigned'),
      value: stats?.documentsAcknowledged ?? 0,
      highlight: true,
    },
  ];
  return (
    <div className="border border-c-rule bg-c-surface p-5">
      <TerminalEyebrow
        as="h2"
        label={t('home.terminal.statsLabel')}
        trailing={t('home.terminal.live')}
      />
      <dl className="mt-3 space-y-0">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between py-1.5 text-xs">
            <dt className="text-c-muted">{row.label}</dt>
            <dd className={cn('text-[13px]', row.highlight ? 'text-c-accent' : 'text-c-fg')}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
