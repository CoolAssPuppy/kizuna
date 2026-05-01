import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { type AppSupabaseClient, getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

import { downloadCsv, rowsToCsv, type CsvRow } from './csv';
import {
  fetchDietarySummary,
  fetchPaymentReconciliation,
  fetchRegistrationProgress,
  fetchRoomingList,
  fetchSwagOrder,
  fetchTransportManifest,
} from './reports';
import { ReportTable } from './ReportTable';
import { ShareReportButton } from './ShareReportButton';

type ReportType = Database['public']['Enums']['report_type'];

interface ReportConfig {
  key: string;
  filename: string;
  reportType: ReportType;
  fetch: (client: AppSupabaseClient, eventId: string | null) => Promise<readonly CsvRow[]>;
}

const REPORTS: ReadonlyArray<ReportConfig> = [
  {
    key: 'registration',
    filename: 'registration-progress.csv',
    reportType: 'full_registration',
    fetch: (c, eid) => (eid ? fetchRegistrationProgress(c, eid) : Promise.resolve([])),
  },
  {
    key: 'rooming',
    filename: 'rooming-list.csv',
    reportType: 'rooming_list',
    fetch: (c, eid) => (eid ? fetchRoomingList(c, eid) : Promise.resolve([])),
  },
  {
    key: 'transport',
    filename: 'transport-manifest.csv',
    reportType: 'transport_manifest',
    fetch: (c) => fetchTransportManifest(c),
  },
  {
    key: 'dietary',
    filename: 'dietary-summary.csv',
    reportType: 'dietary_summary',
    fetch: (c) => fetchDietarySummary(c),
  },
  {
    key: 'swag',
    filename: 'swag-order.csv',
    reportType: 'swag_order',
    fetch: (c) => fetchSwagOrder(c),
  },
  {
    key: 'payments',
    filename: 'payment-reconciliation.csv',
    reportType: 'payment_reconciliation',
    fetch: (c) => fetchPaymentReconciliation(c),
  },
];

const TABS = REPORTS.map((r) => r.key);
type Tab = (typeof TABS)[number];

interface ReportPanelProps {
  rows: ReadonlyArray<CsvRow>;
  filename: string;
  reportType: ReportType;
  eventId: string | null;
}

function ReportPanel({ rows, filename, reportType, eventId }: ReportPanelProps): JSX.Element {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.noRows')}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ShareReportButton reportType={reportType} eventId={eventId} />
        <Button variant="outline" onClick={() => downloadCsv(filename, rowsToCsv(rows))}>
          {t('admin.exportCsv')}
        </Button>
      </div>
      <ReportTable rows={rows} />
    </div>
  );
}

interface ActiveReportProps {
  config: ReportConfig;
  eventId: string | null;
}

function ActiveReport({ config, eventId }: ActiveReportProps): JSX.Element {
  const query = useQuery({
    queryKey: ['admin', config.key, eventId],
    queryFn: () => config.fetch(getSupabaseClient(), eventId),
  });

  // Reports re-issue the live SQL query whenever any contributing table
  // changes. Listening on a generous set keeps every tab fresh; the
  // queryKey carries config.key so only the active report invalidates.
  useRealtimeInvalidation([
    { table: 'registrations', invalidates: ['admin', config.key] },
    { table: 'users', invalidates: ['admin', config.key] },
    { table: 'flights', invalidates: ['admin', config.key] },
    { table: 'transport_requests', invalidates: ['admin', config.key] },
  ]);

  return (
    <ReportPanel
      rows={query.data ?? []}
      filename={config.filename}
      reportType={config.reportType}
      eventId={eventId}
    />
  );
}

export function ReportsScreen(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('registration');
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const activeReport = REPORTS.find((r) => r.key === tab);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.reports.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.reports.subtitle')}</p>
      </header>

      <div role="tablist" className="flex flex-wrap gap-1 rounded-md border p-1">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
              tab === value
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t(`admin.tabs.${value}`)}
          </button>
        ))}
      </div>

      {activeReport ? <ActiveReport config={activeReport} eventId={eventId} /> : null}
    </section>
  );
}
