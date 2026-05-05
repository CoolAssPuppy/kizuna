import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { type AppSupabaseClient, getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { cn } from '@/lib/utils';

import { downloadCsv, rowsToCsv, type CsvRow } from './csv';
import {
  fetchDietarySummary,
  fetchPaymentReconciliation,
  fetchRegistrationProgress,
  fetchRoomingList,
  fetchSwagOrder,
  fetchSwagOrderTotals,
  fetchTransportManifest,
} from './reports';
import { ReportTable } from './ReportTable';

interface ReportConfig {
  key: string;
  filename: string;
  /** i18n key shown in place of the generic "no rows" message. */
  emptyKey?: string;
  fetch: (client: AppSupabaseClient, eventId: string | null) => Promise<readonly CsvRow[]>;
}

const REPORTS: ReadonlyArray<ReportConfig> = [
  {
    key: 'registration',
    filename: 'registration-progress.csv',
    fetch: (c, eid) => (eid ? fetchRegistrationProgress(c, eid) : Promise.resolve([])),
  },
  {
    key: 'rooming',
    filename: 'rooming-list.csv',
    emptyKey: 'admin.empty.rooming',
    fetch: (c, eid) => (eid ? fetchRoomingList(c, eid) : Promise.resolve([])),
  },
  {
    key: 'transport',
    filename: 'transport-manifest.csv',
    emptyKey: 'admin.empty.transport',
    fetch: (c) => fetchTransportManifest(c),
  },
  {
    key: 'dietary',
    filename: 'dietary-summary.csv',
    fetch: (c) => fetchDietarySummary(c),
  },
  {
    key: 'swag',
    filename: 'swag-per-person.csv',
    fetch: (c) => fetchSwagOrder(c),
  },
  {
    key: 'swag_totals',
    filename: 'swag-total-order.csv',
    fetch: (c) => fetchSwagOrderTotals(c),
  },
  {
    key: 'payments',
    filename: 'payment-reconciliation.csv',
    fetch: (c) => fetchPaymentReconciliation(c),
  },
];

const TABS = REPORTS.map((r) => r.key);
type Tab = (typeof TABS)[number];

const BROWSER_DOWNLOAD_GAP_MS = 120;

interface ReportData {
  rows: ReadonlyArray<CsvRow>;
  isLoading: boolean;
}

function useReportRows(config: ReportConfig, eventId: string | null): ReportData {
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
  return { rows: query.data ?? [], isLoading: query.isPending };
}

export function ReportsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>('registration');
  const [isDownloading, setIsDownloading] = useState(false);
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const activeReport = REPORTS.find((r) => r.key === tab) ?? REPORTS[0]!;
  const { rows, isLoading } = useReportRows(activeReport, eventId);

  async function handleDownloadAll(): Promise<void> {
    setIsDownloading(true);
    try {
      const client = getSupabaseClient();
      const fetched = await Promise.all(
        REPORTS.map(async (report) => ({
          filename: report.filename,
          rows: await report.fetch(client, eventId),
        })),
      );
      // Browsers coalesce simultaneous saveAs prompts; pace dispatches.
      for (const { filename, rows } of fetched) {
        downloadCsv(filename, rowsToCsv(rows));
        await new Promise((resolve) => setTimeout(resolve, BROWSER_DOWNLOAD_GAP_MS));
      }
    } catch {
      show(t('admin.reports.downloadFailed'), 'error');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.reports.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleDownloadAll()}
            disabled={isDownloading || !eventId}
            title={t('admin.reports.downloadAll')}
            aria-label={t('admin.reports.downloadAll')}
          >
            <Download aria-hidden className="h-4 w-4" />
          </Button>
        </div>
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

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">{t('app.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          {t(activeReport.emptyKey ?? 'admin.noRows')}
        </p>
      ) : (
        <ReportTable rows={rows} />
      )}
    </section>
  );
}
