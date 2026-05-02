import { useQuery } from '@tanstack/react-query';
import { Download, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { type AppSupabaseClient, getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

import { useToast } from '@/components/ui/toast';

import { downloadCsv, rowsToCsv, type CsvRow } from './csv';
import { buildShareUrl, generateShareToken } from './sharing';
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
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const activeReport = REPORTS.find((r) => r.key === tab) ?? REPORTS[0]!;
  const { rows, isLoading } = useReportRows(activeReport, eventId);

  async function handleCopyShareLink(): Promise<void> {
    if (!eventId) return;
    try {
      const token = generateShareToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await getSupabaseClient().from('report_snapshots').insert({
        event_id: eventId,
        report_type: activeReport.reportType,
        share_token: token,
        share_expires_at: expiresAt,
      });
      if (error) throw error;

      const url = buildShareUrl(window.location.origin, token);
      await navigator.clipboard.writeText(url);
      show(t('admin.share.copied'));
    } catch {
      show(t('admin.share.copyFailed'), 'error');
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
            onClick={() => void handleCopyShareLink()}
            disabled={!eventId}
            title={t('admin.share.copy')}
            aria-label={t('admin.share.copy')}
          >
            <LinkIcon aria-hidden className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => downloadCsv(activeReport.filename, rowsToCsv(rows))}
            disabled={rows.length === 0}
            title={t('admin.exportCsv')}
            aria-label={t('admin.exportCsv')}
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
        <p className="py-8 text-sm text-muted-foreground">{t('admin.noRows')}</p>
      ) : (
        <ReportTable rows={rows} />
      )}
    </section>
  );
}
