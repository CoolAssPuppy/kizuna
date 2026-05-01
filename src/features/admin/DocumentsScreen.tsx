import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';

import { type DocumentRow, deleteDocument, fetchAllDocuments } from './api/documents';
import { DocumentDialog } from './DocumentDialog';

const KIND_LABELS: Record<DocumentRow['document_key'], string> = {
  waiver: 'Waiver',
  code_of_conduct: 'Code of conduct',
  expense_policy: 'Expense policy',
  booking_process: 'Booking process',
  livestream: 'Livestream consent',
  toc: 'Terms and conditions',
};

export function DocumentsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: documents } = useQuery({
    queryKey: ['admin', 'documents', eventId],
    enabled: eventId !== null,
    queryFn: () =>
      eventId ? fetchAllDocuments(getSupabaseClient(), eventId) : Promise.resolve([]),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteDocument(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
      show(t('adminDocuments.deleted'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!event) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }

  const dialogOpen = creating || editingId !== null;
  const editing = editingId ? documents?.find((d) => d.id === editingId) : null;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('adminDocuments.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('adminDocuments.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2 self-start">
          <Plus aria-hidden className="h-4 w-4" />
          {t('adminDocuments.newDocument')}
        </Button>
      </header>

      {!documents || documents.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('adminDocuments.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
            >
              <FileText aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold">{doc.title}</p>
                  <span className="text-xs text-muted-foreground">
                    v{doc.version} · {KIND_LABELS[doc.document_key]} · {doc.content_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('adminDocuments.appliesTo.' + doc.applies_to)}
                  {doc.requires_acknowledgement ? (
                    <>
                      {' · '}
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <CheckCircle2 aria-hidden className="h-3 w-3" />
                        {t('adminDocuments.fields.requiresAcknowledgement')}
                      </span>
                    </>
                  ) : null}
                  {' · '}
                  {mediumDateTimeFormatter.format(new Date(doc.published_at))}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditingId(doc.id)}>
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(t('adminDocuments.deleteConfirm'))) remove.mutate(doc.id);
                  }}
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DocumentDialog
        open={dialogOpen}
        eventId={eventId}
        document={editing ?? null}
        onClose={() => {
          setCreating(false);
          setEditingId(null);
        }}
      />
    </section>
  );
}
