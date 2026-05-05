import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileDown,
  Pencil,
  Plus,
  Search,
  Tags,
  ThumbsUp,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { zonedDateTimeLocalToUtcIso } from '@/lib/timezone';
import { cn } from '@/lib/utils';

import { type AdminProposedSession, fetchAdminProposals } from '@/features/agenda/api';
import { dayHeading, dayKey } from '@/features/agenda/grouping';
import { loadExpectedAttendance } from '@/features/agenda/guestAttendance';
import { TagPills } from '@/features/agenda/TagPill';
import { type SessionTag, fetchTagsForSessions, setSessionTags } from '@/features/agenda/tagsApi';

import { agendaToCsv, blankAgendaCsv, importAgendaCsv, sessionsToCsvRows } from './agendaCsv';
import {
  type SessionRow,
  createSession,
  deleteSession,
  fetchAllSessions,
  updateSession,
} from './api/sessions';
import { downloadCsv } from './csv';
import { SessionDialog } from './SessionDialog';
import { type SessionDraft, emptySessionDraft, rowToDraft } from './sessionDraft';
import { TagsDialog } from './TagsDialog';

type ProposalSort = 'votes' | 'proposer';

interface DayBucket {
  iso: string;
  heading: string;
}

function uniqueDayBuckets(sessions: ReadonlyArray<SessionRow>, timeZone: string): DayBucket[] {
  const seen = new Map<string, string>();
  for (const s of sessions) {
    if (!s.starts_at) continue;
    const key = dayKey(s.starts_at, timeZone);
    if (!seen.has(key)) seen.set(key, dayHeading(s.starts_at, timeZone));
  }
  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, heading]) => ({ iso, heading }));
}

const PROPOSED_FILTER = 'proposed';

export function AgendaAdminScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<SessionDraft | null>(null);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [proposalSort, setProposalSort] = useState<ProposalSort>('votes');
  const [proposalQuery, setProposalQuery] = useState('');
  const [importStatus, setImportStatus] = useState<{
    imported: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ['admin', 'agenda', eventId],
    enabled: eventId !== null,
    queryFn: () => (eventId ? fetchAllSessions(getSupabaseClient(), eventId) : Promise.resolve([])),
  });

  // Keyed on session count so adding/removing a session refetches, but
  // editing the title of an existing session doesn't churn the cache
  // entry (the session id list is stable).
  const { data: tagsBySession = new Map<string, SessionTag[]>() } = useQuery({
    queryKey: ['admin', 'agenda', 'session-tags', eventId, sessions?.length ?? 0],
    enabled: eventId !== null && Boolean(sessions),
    queryFn: () =>
      fetchTagsForSessions(
        getSupabaseClient(),
        (sessions ?? []).map((s) => s.id),
      ),
  });

  // Used by SessionListItem to render "Current expected attendance" for
  // audience='all' sessions. Pulls a single registration count + a per-
  // session guest-opt-in count so the row math is just `employees +
  // guestsBySession.get(id)`.
  const { data: expectedAttendance } = useQuery({
    queryKey: ['admin', 'agenda', 'expected-attendance', eventId],
    enabled: eventId !== null,
    queryFn: () =>
      eventId
        ? loadExpectedAttendance(getSupabaseClient(), eventId)
        : Promise.resolve({ employeeCount: 0, guestsBySession: new Map<string, number>() }),
  });

  const activeSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.status === 'active'),
    [sessions],
  );

  const { data: proposals } = useQuery({
    queryKey: ['admin', 'agenda', 'proposals', eventId, userId],
    enabled: eventId !== null && userId !== null && dayFilter === PROPOSED_FILTER,
    queryFn: () =>
      eventId && userId
        ? fetchAdminProposals(getSupabaseClient(), { eventId, userId })
        : Promise.resolve([] as AdminProposedSession[]),
  });

  const timeZone = event?.time_zone ?? 'UTC';
  const dayBuckets = useMemo(
    () => uniqueDayBuckets(activeSessions, timeZone),
    [activeSessions, timeZone],
  );
  const visibleSessions = useMemo(() => {
    if (dayFilter === PROPOSED_FILTER) return [];
    return dayFilter === 'all'
      ? activeSessions
      : activeSessions.filter((s) => dayKey(s.starts_at, timeZone) === dayFilter);
  }, [activeSessions, dayFilter, timeZone]);

  const filteredProposals = useMemo(() => {
    const list = proposals ?? [];
    const q = proposalQuery.trim().toLowerCase();
    const matched = q
      ? list.filter((p) => {
          const haystack = [p.title, p.abstract ?? '', p.proposer_display_name ?? '']
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        })
      : list;
    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (proposalSort === 'votes') {
        if (a.vote_count !== b.vote_count) return b.vote_count - a.vote_count;
        return a.title.localeCompare(b.title);
      }
      const an = a.proposer_display_name ?? '';
      const bn = b.proposer_display_name ?? '';
      if (an !== bn) return an.localeCompare(bn);
      return a.title.localeCompare(b.title);
    });
    return sorted;
  }, [proposals, proposalQuery, proposalSort]);

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
      const isProposed = draft.status === 'proposed';
      const capacity = draft.capacity.trim() ? Number.parseInt(draft.capacity.trim(), 10) : null;
      const scheduleFields = isProposed
        ? { starts_at: null, ends_at: null, location: null, capacity: null }
        : {
            starts_at: zonedDateTimeLocalToUtcIso(draft.starts_at, timeZone),
            ends_at: zonedDateTimeLocalToUtcIso(draft.ends_at, timeZone),
            location: draft.location.trim() || null,
            capacity: Number.isFinite(capacity) ? capacity : null,
          };
      const payload = {
        event_id: eventId,
        title: draft.title,
        subtitle: draft.subtitle.trim() || null,
        type: draft.type,
        audience: draft.audience,
        status: draft.status,
        is_mandatory: draft.is_mandatory,
        abstract: draft.abstract.trim() || null,
        speaker_email: draft.speaker_email.trim().toLowerCase() || null,
        ...scheduleFields,
      };
      const row = draft.id
        ? await updateSession(getSupabaseClient(), draft.id, payload)
        : await createSession(getSupabaseClient(), payload);
      await setSessionTags(getSupabaseClient(), {
        sessionId: row.id,
        tagIds: draft.tag_ids,
      });
      return row;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'agenda'] });
      await queryClient.invalidateQueries({ queryKey: ['agenda'] });
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
            icon={<FileDown aria-hidden className="h-4 w-4" />}
            label={t('admin.agenda.downloadBlank')}
            onClick={handleDownloadBlank}
          />
          <IconAction
            icon={<Download aria-hidden className="h-4 w-4" />}
            label={t('admin.agenda.downloadCurrent')}
            onClick={handleDownloadCurrent}
          />
          <IconAction
            icon={<Upload aria-hidden className="h-4 w-4" />}
            label={
              importMutation.isPending ? t('admin.agenda.importing') : t('admin.agenda.import')
            }
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          />
          <IconAction
            icon={<Tags aria-hidden className="h-4 w-4" />}
            label={t('admin.agenda.editTags')}
            onClick={() => setTagsDialogOpen(true)}
          />
          <Button onClick={() => setEditing(emptySessionDraft())} className="gap-2 self-start">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {dayFilter === PROPOSED_FILTER
              ? t('admin.agenda.proposalsHeader', { count: filteredProposals.length })
              : t('admin.agenda.currentSessions', { count: visibleSessions.length })}
          </h3>
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label={t('agenda.dayFilterLabel')}
          >
            <option value="all">{t('agenda.allDays')}</option>
            {dayBuckets.map((day) => (
              <option key={day.iso} value={day.iso}>
                {day.heading}
              </option>
            ))}
            <option value={PROPOSED_FILTER}>{t('agenda.proposed')}</option>
          </select>
        </div>

        {dayFilter === PROPOSED_FILTER ? (
          <AdminProposalsList
            proposals={filteredProposals}
            query={proposalQuery}
            onQueryChange={setProposalQuery}
            sort={proposalSort}
            onSortChange={setProposalSort}
            onEdit={(p) =>
              setEditing(
                rowToDraft(
                  p,
                  timeZone,
                  p.tags.map((tag) => tag.id),
                ),
              )
            }
          />
        ) : visibleSessions.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {visibleSessions.map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                tags={tagsBySession.get(s.id) ?? []}
                isPast={s.ends_at ? new Date(s.ends_at).getTime() < Date.now() : false}
                expectedEmployees={expectedAttendance?.employeeCount ?? 0}
                expectedGuests={expectedAttendance?.guestsBySession.get(s.id) ?? 0}
                onEdit={() =>
                  setEditing(
                    rowToDraft(
                      s,
                      timeZone,
                      (tagsBySession.get(s.id) ?? []).map((tag) => tag.id),
                    ),
                  )
                }
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
        timeZone={timeZone}
        eventId={eventId ?? ''}
        onClose={() => setEditing(null)}
        onSave={(d) => save.mutate(d)}
        saving={save.isPending}
      />

      <TagsDialog
        open={tagsDialogOpen}
        eventId={eventId ?? ''}
        onClose={() => setTagsDialogOpen(false)}
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
      size="icon"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

interface SessionListItemProps {
  session: SessionRow;
  tags: ReadonlyArray<SessionTag>;
  isPast: boolean;
  expectedEmployees: number;
  expectedGuests: number;
  onEdit: () => void;
  onDelete: () => void;
}

function SessionListItem({
  session,
  tags,
  isPast,
  expectedEmployees,
  expectedGuests,
  onEdit,
  onDelete,
}: SessionListItemProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      className={cn(
        'group flex items-start gap-3 px-4 py-3 text-sm hover:bg-muted/30',
        isPast && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-start gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span className="font-medium">{session.title}</span>
          {session.subtitle ? (
            <p className="text-xs text-muted-foreground">{session.subtitle}</p>
          ) : null}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t(`admin.agenda.types.${session.type}`)} ·{' '}
            {t(`admin.agenda.audiences.${session.audience}`)}
            {session.location ? ` · ${session.location}` : ''}
          </p>
          {session.audience === 'all' ? (
            <p className="text-[11px] text-muted-foreground">
              {t('admin.agenda.expectedAttendance', {
                employees: expectedEmployees,
                guests: expectedGuests,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {session.starts_at ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {mediumDateTimeFormatter.format(new Date(session.starts_at))}
            </span>
          ) : null}
          <TagPills tags={tags} className="justify-end" />
        </div>
      </button>
      <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label={t('actions.edit')}
        >
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

interface AdminProposalsListProps {
  proposals: ReadonlyArray<AdminProposedSession>;
  query: string;
  onQueryChange: (next: string) => void;
  sort: ProposalSort;
  onSortChange: (next: ProposalSort) => void;
  onEdit: (proposal: AdminProposedSession) => void;
}

function AdminProposalsList({
  proposals,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onEdit,
}: AdminProposalsListProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('admin.agenda.proposalsSearchPlaceholder')}
            aria-label={t('admin.agenda.proposalsSearchLabel')}
            className="pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as ProposalSort)}
          aria-label={t('admin.agenda.proposalsSortLabel')}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="votes">{t('admin.agenda.proposalsSort.votes')}</option>
          <option value="proposer">{t('admin.agenda.proposalsSort.proposer')}</option>
        </select>
      </div>
      {proposals.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('admin.agenda.proposalsEmpty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {proposals.map((p) => (
            <li key={p.id} className="space-y-2 px-4 py-3 text-sm hover:bg-muted/30">
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="flex w-full flex-col items-start gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                    <ThumbsUp aria-hidden className="h-3.5 w-3.5" />
                    {t('agenda.proposals.voteCount', { count: p.vote_count })}
                  </span>
                </div>
                {p.abstract ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.abstract}</p>
                ) : null}
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('agenda.proposals.proposedBy', {
                    name: p.proposer_display_name ?? t('agenda.proposals.unknownProposer'),
                  })}
                </p>
                <TagPills tags={p.tags} className="pt-1" />
              </button>
              {p.voters.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t('admin.agenda.proposalsVoters')}:
                  </span>{' '}
                  {p.voters.map((v) => v.display_name).join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
