import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileDown, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';

import {
  agendaToCsv,
  blankAgendaCsv,
  importAgendaCsv,
  sessionsToCsvRows,
} from './agendaCsv';
import {
  type SessionRow,
  createSession,
  deleteSession,
  fetchAllSessions,
  updateSession,
} from './api/sessions';
import { downloadCsv } from './csv';
import { SessionDialog } from './SessionDialog';
import {
  type SessionDraft,
  emptySessionDraft,
  rowToDraft,
} from './sessionDraft';

function toIso(value: string): string {
  return new Date(value).toISOString();
}

export function AgendaAdminScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const queryClient = useQueryClient();
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<SessionDraft | null>(null);
  const [importStatus, setImportStatus] = useState<{
    imported: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ['admin', 'agenda', eventId],
    enabled: eventId !== null,
    queryFn: () => (eventId ? fetchAllSessions(getSupabaseClient(), eventId) : Promise.resolve([])),
  });

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

  const save = useMutation({
    mutationFn: async (draft: SessionDraft) => {
      if (!eventId) throw new Error('No active event');
      const capacity = draft.capacity.trim()
        ? Number.parseInt(draft.capacity.trim(), 10)
        : null;
      const payload = {
        event_id: eventId,
        title: draft.title,
        subtitle: draft.subtitle.trim() || null,
        type: draft.type,
        audience: draft.audience,
        starts_at: toIso(draft.starts_at),
        ends_at: toIso(draft.ends_at),
        location: draft.location.trim() || null,
        capacity: Number.isFinite(capacity ?? NaN) ? capacity : null,
        is_mandatory: draft.is_mandatory,
        abstract: draft.abstract.trim() || null,
        speaker_email: draft.speaker_email.trim().toLowerCase() || null,
      };
      if (draft.id) return updateSession(getSupabaseClient(), draft.id, payload);
      return createSession(getSupabaseClient(), payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'agenda'] });
      setEditing(null);
      show(t('admin.agenda.saved'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteSession(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'agenda'] });
      show(t('admin.agenda.deleted'));
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.agenda.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.agenda.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <IconAction
            icon={<FileDown aria-hidden className="h-3.5 w-3.5" />}
            label={t('admin.agenda.downloadBlank')}
            onClick={handleDownloadBlank}
          />
          <IconAction
            icon={<Download aria-hidden className="h-3.5 w-3.5" />}
            label={t('admin.agenda.downloadCurrent')}
            onClick={handleDownloadCurrent}
          />
          <IconAction
            icon={<Upload aria-hidden className="h-3.5 w-3.5" />}
            label={importMutation.isPending ? t('admin.agenda.importing') : t('admin.agenda.import')}
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          />
          <Button size="sm" onClick={() => setEditing(emptySessionDraft())} className="gap-2">
            <Plus aria-hidden className="h-4 w-4" />
            {t('admin.agenda.addSession')}
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
      </header>

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
              <SessionListItem
                key={s.id}
                session={s}
                onEdit={() => setEditing(rowToDraft(s))}
                onDelete={() => {
                  if (confirm(t('admin.agenda.deleteConfirm'))) remove.mutate(s.id);
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin.agenda.empty')}
          </p>
        )}
      </div>

      <SessionDialog
        draft={editing}
        onClose={() => setEditing(null)}
        onSave={(d) => save.mutate(d)}
        saving={save.isPending}
      />
    </section>
  );
}

interface IconActionProps {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function IconAction({ icon, label, onClick, disabled }: IconActionProps): JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="h-8 w-8 p-0"
    >
      {icon}
    </Button>
  );
}

interface SessionListItemProps {
  session: SessionRow;
  onEdit: () => void;
  onDelete: () => void;
}

function SessionListItem({ session, onEdit, onDelete }: SessionListItemProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <li className="group flex items-start gap-3 px-4 py-3 text-sm hover:bg-muted/30">
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 flex-col items-start gap-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 self-stretch">
          <span className="font-medium">{session.title}</span>
          <span className="tabular-nums text-xs text-muted-foreground">
            {mediumDateTimeFormatter.format(new Date(session.starts_at))}
          </span>
        </div>
        {session.subtitle ? (
          <p className="text-xs text-muted-foreground">{session.subtitle}</p>
        ) : null}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {t(`admin.agenda.types.${session.type}`)} · {t(`admin.agenda.audiences.${session.audience}`)}
          {session.location ? ` · ${session.location}` : ''}
        </p>
      </button>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} aria-label={t('actions.edit')}>
          <Pencil aria-hidden className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onDelete}
          aria-label={t('actions.delete')}
        >
          <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
