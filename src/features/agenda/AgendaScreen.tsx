import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Star, StarOff, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { SessionDialog } from '@/features/admin/SessionDialog';
import { type SessionDraft, emptySessionDraft, rowToDraft } from '@/features/admin/sessionDraft';
import { useAuth } from '@/features/auth/AuthContext';
import { listAdditionalGuests } from '@/features/guests/api';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

import {
  type AgendaSession,
  type ProposalDraft,
  type ProposedSession,
  createProposal,
  deleteOwnProposal,
  updateOwnProposal,
} from './api';
import { dayKey, groupSessionsByDay } from './grouping';
import { attendanceKey, loadSponsorGuestAttendance, setGuestAttendance } from './guestAttendance';
import { isGuestOptInSession } from './sessionRules';
import { TagPills } from './TagPill';
import { useAgenda } from './useAgenda';
import { useProposals } from './useProposals';

type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];

type EventRow = Database['public']['Tables']['events']['Row'];

interface Props {
  event: EventRow;
}

type FilterMode = 'all' | 'favorites' | 'proposed';

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function AgendaScreen({ event }: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [filter, setFilter] = useState<FilterMode>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [proposeDraft, setProposeDraft] = useState<SessionDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading, error, toggleFavorite } = useAgenda(event.id);
  const { proposals, vote, isVoting, refetch } = useProposals(event.id);
  const queryClient = useQueryClient();

  // Sponsors with additional_guests can opt those guests in/out of
  // audience='all' meal/social/activity sessions. Both queries stay
  // disabled (and effectively silent) when the user has no guests.
  const guestsQuery = useQuery({
    queryKey: ['additional-guests', userId ?? null],
    enabled: !!userId,
    queryFn: () => listAdditionalGuests(getSupabaseClient(), userId!),
  });
  const myGuests: ReadonlyArray<AdditionalGuestRow> = guestsQuery.data ?? [];
  const hasGuests = myGuests.length > 0;

  const attendanceQuery = useQuery({
    queryKey: ['session-guest-attendance', userId ?? null],
    enabled: !!userId && hasGuests,
    queryFn: () => loadSponsorGuestAttendance(getSupabaseClient(), userId!),
  });
  const attendance = attendanceQuery.data ?? new Set<string>();

  const toggleAttendance = useMutation({
    mutationFn: (vars: { sessionId: string; additionalGuestId: string; attending: boolean }) =>
      setGuestAttendance(getSupabaseClient(), vars),
    onMutate: async (vars) => {
      const key = ['session-guest-attendance', userId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Set<string>>(key);
      queryClient.setQueryData<Set<string>>(key, (old) => {
        const next = new Set(old ?? []);
        const composed = attendanceKey(vars.sessionId, vars.additionalGuestId);
        if (vars.attending) next.add(composed);
        else next.delete(composed);
        return next;
      });
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      show(err.message, 'error');
      if (ctx?.prev) {
        queryClient.setQueryData(['session-guest-attendance', userId], ctx.prev);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['session-guest-attendance', userId] }),
  });

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10" aria-busy="true">
        <p className="text-muted-foreground">{t('agenda.loading')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  const sessions = data ?? [];
  const allDays = groupSessionsByDay(sessions, event.time_zone);
  const now = Date.now();

  // Mandatory sessions stay visible in "My picks" even if the user hasn't
  // starred them — they're auto-attended and would be confusing to hide.
  const filteredByMode =
    filter === 'favorites' ? sessions.filter((s) => s.is_favorite || s.is_mandatory) : sessions;
  const visible =
    dayFilter === 'all'
      ? filteredByMode
      : filteredByMode.filter((s) => dayKey(s.starts_at, event.time_zone) === dayFilter);
  const days = groupSessionsByDay(visible, event.time_zone);
  const favoriteCount = sessions.filter((s) => s.is_favorite || s.is_mandatory).length;

  async function submitProposal(draft: SessionDraft): Promise<void> {
    if (!userId) return;
    setSubmitting(true);
    try {
      const proposal: ProposalDraft = {
        title: draft.title,
        subtitle: draft.subtitle,
        type: draft.type,
        audience: draft.audience,
        abstract: draft.abstract,
        speaker_email: draft.speaker_email,
        is_mandatory: draft.is_mandatory,
        tag_ids: draft.tag_ids,
      };
      if (draft.id) {
        await updateOwnProposal(getSupabaseClient(), {
          sessionId: draft.id,
          draft: proposal,
        });
        show(t('agenda.proposals.updated'));
      } else {
        await createProposal(getSupabaseClient(), {
          eventId: event.id,
          userId,
          draft: proposal,
        });
        show(t('agenda.proposals.submitted'));
      }
      setProposeDraft(null);
      void refetch();
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProposal(proposal: ProposedSession): Promise<void> {
    if (!confirm(t('agenda.proposals.deleteConfirm', { title: proposal.title }))) return;
    try {
      await deleteOwnProposal(getSupabaseClient(), proposal.id);
      show(t('agenda.proposals.deleted'));
      void refetch();
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  function editProposal(proposal: ProposedSession): void {
    setProposeDraft(
      rowToDraft(
        proposal,
        event.time_zone,
        proposal.tags.map((tag) => tag.id),
      ),
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('agenda.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('agenda.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-md border p-1">
          <FilterTab
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t('agenda.filters.all', { count: sessions.length })}
          />
          <FilterTab
            active={filter === 'favorites'}
            onClick={() => setFilter('favorites')}
            label={t('agenda.filters.favorites', { count: favoriteCount })}
          />
          <FilterTab
            active={filter === 'proposed'}
            onClick={() => setFilter('proposed')}
            label={t('agenda.filters.proposed', { count: proposals.length })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setProposeDraft(emptySessionDraft())}
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t('agenda.proposals.proposeButton')}
          </Button>
          {filter !== 'proposed' && allDays.length > 1 ? (
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              aria-label={t('agenda.dayFilterLabel')}
            >
              <option value="all">{t('agenda.allDays')}</option>
              {allDays.map((day) => (
                <option key={day.iso} value={day.iso}>
                  {day.heading}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {filter === 'proposed' ? (
        <ProposalsList
          proposals={proposals}
          currentUserId={userId}
          onVote={(p) => vote(p)}
          onEdit={editProposal}
          onDelete={(p) => {
            void deleteProposal(p);
          }}
          isVoting={isVoting}
        />
      ) : days.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {filter === 'favorites' ? t('agenda.noFavorites') : t('agenda.empty')}
        </p>
      ) : (
        <div className="space-y-10">
          {days.map((day) => (
            <section key={day.iso} className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {day.heading}
              </h2>
              <ul className="space-y-3">
                {day.sessions.map((session) => {
                  const showPicker = hasGuests && isGuestOptInSession(session);
                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      timeZone={event.time_zone}
                      isPast={session.ends_at ? new Date(session.ends_at).getTime() < now : false}
                      onToggleFavorite={() => toggleFavorite(session)}
                      favoriteLabel={t(
                        session.is_favorite ? 'agenda.unfavorite' : 'agenda.favorite',
                      )}
                      guestPicker={
                        showPicker
                          ? {
                              guests: myGuests,
                              attendance,
                              onToggle: (additionalGuestId, attending) =>
                                toggleAttendance.mutate({
                                  sessionId: session.id,
                                  additionalGuestId,
                                  attending,
                                }),
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <SessionDialog
        draft={proposeDraft}
        timeZone={event.time_zone}
        eventId={event.id}
        mode="propose"
        warning={proposeDraft?.id ? t('agenda.proposals.editWarning') : null}
        onClose={() => setProposeDraft(null)}
        onSave={(d) => {
          void submitProposal(d);
        }}
        saving={submitting}
      />
    </main>
  );
}

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function FilterTab({ active, onClick, label }: FilterTabProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

interface SessionCardProps {
  session: AgendaSession;
  timeZone: string;
  isPast: boolean;
  onToggleFavorite: () => void;
  favoriteLabel: string;
  /** Omitted when this session does not expose the guest picker. */
  guestPicker?:
    | {
        guests: ReadonlyArray<AdditionalGuestRow>;
        attendance: ReadonlySet<string>;
        onToggle: (additionalGuestId: string, attending: boolean) => void;
      }
    | undefined;
}

function SessionCard({
  session,
  timeZone,
  isPast,
  onToggleFavorite,
  favoriteLabel,
  guestPicker,
}: SessionCardProps): JSX.Element {
  const { t } = useTranslation();
  // Mandatory sessions are always-on for everyone — render them as
  // starred and disable the toggle so the UX matches the data model.
  const showAsStarred = session.is_favorite || session.is_mandatory;
  const Icon = showAsStarred ? Star : StarOff;
  const buttonLabel = session.is_mandatory ? t('agenda.mandatoryLabel') : favoriteLabel;
  return (
    <li
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40',
        isPast && 'opacity-50',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {session.starts_at && session.ends_at ? (
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              {formatTime(session.starts_at, timeZone)} — {formatTime(session.ends_at, timeZone)}
              {session.location ? <span> · {session.location}</span> : null}
            </p>
          ) : null}
          <h3 className="text-base font-semibold">{session.title}</h3>
          {session.subtitle ? (
            <p className="text-sm text-muted-foreground">{session.subtitle}</p>
          ) : null}
          {session.speaker_display_name || session.speaker_email ? (
            <p className="text-xs text-muted-foreground">
              {session.speaker_display_name ?? session.speaker_email}
            </p>
          ) : null}
          {session.abstract ? (
            <p className="pt-2 text-sm leading-relaxed text-foreground/80">{session.abstract}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <TagPills tags={session.tags} />
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={buttonLabel}
            title={buttonLabel}
            disabled={session.is_mandatory}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              showAsStarred
                ? 'text-amber-500 hover:bg-amber-100/40'
                : 'text-muted-foreground hover:bg-muted',
              session.is_mandatory && 'cursor-not-allowed opacity-80 hover:bg-transparent',
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      {guestPicker ? (
        <fieldset className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('agenda.guests.prompt')}
          </legend>
          <div className="flex flex-wrap gap-3 pt-1">
            {guestPicker.guests.map((guest) => {
              const id = `guest-attend-${session.id}-${guest.id}`;
              const checked = guestPicker.attendance.has(attendanceKey(session.id, guest.id));
              const guestName = `${guest.first_name} ${guest.last_name}`.trim();
              return (
                <label key={guest.id} htmlFor={id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => guestPicker.onToggle(guest.id, next === true)}
                  />
                  {guestName}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </li>
  );
}

interface ProposalsListProps {
  proposals: ReadonlyArray<ProposedSession>;
  currentUserId: string | null;
  onVote: (proposal: ProposedSession) => void;
  onEdit: (proposal: ProposedSession) => void;
  onDelete: (proposal: ProposedSession) => void;
  isVoting: boolean;
}

function ProposalsList({
  proposals,
  currentUserId,
  onVote,
  onEdit,
  onDelete,
  isVoting,
}: ProposalsListProps): JSX.Element {
  const { t } = useTranslation();
  if (proposals.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('agenda.proposals.empty')}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {proposals.map((proposal) => {
        const isOwn = currentUserId !== null && proposal.proposed_by === currentUserId;
        return (
          <li
            key={proposal.id}
            className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-semibold">{proposal.title}</h3>
                {proposal.abstract ? (
                  <p className="pt-1 text-sm leading-relaxed text-foreground/80">
                    {proposal.abstract}
                  </p>
                ) : null}
                <p className="pt-2 text-xs text-muted-foreground">
                  {t('agenda.proposals.proposedBy', {
                    name: proposal.proposer_display_name ?? t('agenda.proposals.unknownProposer'),
                  })}
                </p>
                <TagPills tags={proposal.tags} className="pt-1" />
              </div>
              <div className="flex items-center gap-2">
                {isOwn ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(proposal)}
                      aria-label={t('agenda.proposals.editAction', { title: proposal.title })}
                    >
                      <Pencil aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDelete(proposal)}
                      aria-label={t('agenda.proposals.deleteAction', { title: proposal.title })}
                    >
                      <Trash2 aria-hidden className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant={proposal.has_voted ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-2"
                  disabled={proposal.has_voted || isVoting}
                  onClick={() => onVote(proposal)}
                  aria-label={
                    proposal.has_voted
                      ? t('agenda.proposals.alreadyVoted', { count: proposal.vote_count })
                      : t('agenda.proposals.vote')
                  }
                >
                  <ThumbsUp aria-hidden className="h-4 w-4" />
                  {proposal.has_voted
                    ? t('agenda.proposals.voteCount', { count: proposal.vote_count })
                    : t('agenda.proposals.vote')}
                  {!proposal.has_voted && proposal.vote_count > 0 ? (
                    <span className="text-xs text-muted-foreground">({proposal.vote_count})</span>
                  ) : null}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
