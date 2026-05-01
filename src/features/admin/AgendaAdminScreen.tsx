import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import type { Database } from '@/types/database.types';

import {
  agendaToCsv,
  blankAgendaCsv,
  importAgendaCsv,
  sessionsToCsvRows,
} from './agendaCsv';
import { downloadCsv } from './csv';

type SessionRow = Database['public']['Tables']['sessions']['Row'];

async function loadSessions(eventId: string): Promise<SessionRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('sessions')
    .select('*')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function AgendaAdminScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const queryClient = useQueryClient();
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{
    imported: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ['admin', 'agenda', eventId],
    enabled: eventId !== null,
    queryFn: () => (eventId ? loadSessions(eventId) : Promise.resolve([])),
  });

  useRealtimeInvalidation([
    { table: 'sessions', invalidates: ['admin', 'agenda'] },
  ]);

  const importMutation = useMutation({
    mutationFn: async (csv: string) => {
      if (!event) throw new Error('No active event');
      return importAgendaCsv(getSupabaseClient(), {
        eventId: event.id,
        eventStartDate: event.start_date,
        eventTimeZone: event.time_zone,
        csv,
      });
    },
    onSuccess: async (result) => {
      setImportStatus(result);
      if (result.imported > 0) {
        show(t('admin.agenda.imported', { count: result.imported }));
        await queryClient.invalidateQueries({ queryKey: ['admin', 'agenda'] });
      }
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  function handleDownloadBlank(): void {
    downloadCsv('agenda-template.csv', blankAgendaCsv());
  }

  function handleDownloadCurrent(): void {
    if (!event) return;
    const rows = sessionsToCsvRows(sessions ?? [], event.start_date);
    downloadCsv(`agenda-${event.start_date}.csv`, agendaToCsv(rows));
  }

  function handleFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const csv = typeof reader.result === 'string' ? reader.result : '';
      importMutation.mutate(csv);
    };
    reader.readAsText(file);
  }

  if (!event) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.agenda.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.agenda.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-4">
        <Button variant="outline" onClick={handleDownloadBlank} className="gap-2">
          <Download aria-hidden className="h-4 w-4" />
          {t('admin.agenda.downloadBlank')}
        </Button>
        <Button variant="outline" onClick={handleDownloadCurrent} className="gap-2">
          <Download aria-hidden className="h-4 w-4" />
          {t('admin.agenda.downloadCurrent')}
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
          className="gap-2"
        >
          <Upload aria-hidden className="h-4 w-4" />
          {importMutation.isPending ? t('admin.agenda.importing') : t('admin.agenda.import')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {importStatus ? (
        <div className="space-y-2 rounded-md border p-4 text-sm">
          <p>
            <strong>{t('admin.agenda.imported', { count: importStatus.imported })}</strong>
          </p>
          {importStatus.errors.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">
              {importStatus.errors.map((e, i) => (
                <li key={i}>
                  {t('admin.agenda.errorRow', { row: e.row })}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin.agenda.currentSessions', { count: sessions?.length ?? 0 })}
        </h3>
        {sessions && sessions.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {sessions.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{s.title}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {mediumDateFormatter.format(new Date(s.starts_at))}
                  </span>
                </div>
                {s.subtitle ? (
                  <p className="text-xs text-muted-foreground">{s.subtitle}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin.agenda.empty')}
          </p>
        )}
      </div>
    </section>
  );
}
