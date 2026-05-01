import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';

import { fetchNudgeHistory } from './api/nudges';
import { NudgeDialog } from './NudgeDialog';
import { ReportTable } from './ReportTable';
import type { CsvRow } from './csv';

export function NudgesScreen(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ['admin', 'nudges'],
    queryFn: () => fetchNudgeHistory(getSupabaseClient()),
  });

  const rows: ReadonlyArray<CsvRow> = (history ?? []).map((row) => ({
    sent_at: mediumDateTimeFormatter.format(new Date(row.sent_at)),
    recipient: row.recipient_email,
    channel: row.channel,
    type: row.type,
    subject: row.subject,
    delivered: row.delivered,
  }));

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.nudges.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.nudges.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 self-start">
          <Send aria-hidden className="h-4 w-4" />
          {t('admin.nudges.send')}
        </Button>
      </header>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('admin.nudges.empty')}
        </p>
      ) : (
        <ReportTable rows={rows} />
      )}

      <NudgeDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
