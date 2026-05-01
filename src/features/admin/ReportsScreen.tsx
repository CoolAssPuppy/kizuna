import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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

function useReportRows(
  config: ReportConfig,
  eventId: string | null,
): ReadonlyArray<CsvRow> {
  const query = useQuery({
    queryKey: ['admin', config.key, eventId],
    queryFn: () => config.fetch(getSupabaseClient(), eventId),
  });
  useRealtimeInvalidation([
    { table: 'registrations', invalidates: ['admin', config.key] },
    { table: 'users', invalidates: ['admin', config.key] },
    { table: 'flights', invalidates: ['admin', config.key] },
    { table: 'transport_requests', invalidates: ['admin', config.key] },
  ]);
  return query.data ?? [];
}

export function ReportsScreen(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('registration');
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const activeReport = REPORTS.find((r) => r.key === tab) ?? REPORTS[0]!;
  const rows = useReportRows(activeReport, eventId);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.reports.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.reports.subtitle')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(activeReport.filename, rowsToCsv(rows))}
          disabled={rows.length === 0}
          className="h-8 w-8 self-start p-0"
          title={t('admin.exportCsv')}
          aria-label={t('admin.exportCsv')}
        >
          <Download aria-hidden className="h-3.5 w-3.5" />
        </Button>
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

      {rows.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{t('admin.noRows')}</p>
      ) : (
        <ReportTable rows={rows} />
      )}
    </section>
  );
}
