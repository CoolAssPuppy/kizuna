import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { ConflictsPanel } from './ConflictsPanel';
import { downloadCsv, rowsToCsv, type CsvRow } from './csv';
import {
  fetchDietarySummary,
  fetchPaymentReconciliation,
  fetchRegistrationProgress,
  fetchRoomingList,
  fetchSwagOrder,
} from './reports';

type Tab = 'registration' | 'rooming' | 'dietary' | 'swag' | 'payments' | 'conflicts';

const TABS: ReadonlyArray<Tab> = [
  'registration',
  'rooming',
  'dietary',
  'swag',
  'payments',
  'conflicts',
];

interface ReportPanelProps<R extends CsvRow> {
  rows: R[];
  filename: string;
}

function ReportPanel<R extends CsvRow>({ rows, filename }: ReportPanelProps<R>): JSX.Element {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.noRows')}</p>;
  }
  const headers = Object.keys(rows[0]!);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={() => downloadCsv(filename, rowsToCsv(rows))}>
          {t('admin.exportCsv')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 align-top">
                    {String(row[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminScreen(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('registration');
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const supabase = useMemo(() => getSupabaseClient(), []);

  const registrationQ = useQuery({
    queryKey: ['admin', 'registration', eventId],
    enabled: tab === 'registration' && eventId !== null,
    queryFn: () => (eventId ? fetchRegistrationProgress(supabase, eventId) : Promise.resolve([])),
  });
  const roomingQ = useQuery({
    queryKey: ['admin', 'rooming', eventId],
    enabled: tab === 'rooming' && eventId !== null,
    queryFn: () => (eventId ? fetchRoomingList(supabase, eventId) : Promise.resolve([])),
  });
  const dietaryQ = useQuery({
    queryKey: ['admin', 'dietary'],
    enabled: tab === 'dietary',
    queryFn: () => fetchDietarySummary(supabase),
  });
  const swagQ = useQuery({
    queryKey: ['admin', 'swag'],
    enabled: tab === 'swag',
    queryFn: () => fetchSwagOrder(supabase),
  });
  const paymentsQ = useQuery({
    queryKey: ['admin', 'payments'],
    enabled: tab === 'payments',
    queryFn: () => fetchPaymentReconciliation(supabase),
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
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

      {tab === 'registration' ? (
        <ReportPanel rows={registrationQ.data ?? []} filename="registration-progress.csv" />
      ) : null}
      {tab === 'rooming' ? (
        <ReportPanel rows={roomingQ.data ?? []} filename="rooming-list.csv" />
      ) : null}
      {tab === 'dietary' ? (
        <ReportPanel rows={dietaryQ.data ?? []} filename="dietary-summary.csv" />
      ) : null}
      {tab === 'swag' ? <ReportPanel rows={swagQ.data ?? []} filename="swag-order.csv" /> : null}
      {tab === 'payments' ? (
        <ReportPanel rows={paymentsQ.data ?? []} filename="payment-reconciliation.csv" />
      ) : null}
      {tab === 'conflicts' ? <ConflictsPanel /> : null}
    </main>
  );
}
