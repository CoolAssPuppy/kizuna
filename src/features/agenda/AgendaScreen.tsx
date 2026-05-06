import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { SessionDialog } from '@/features/admin/agenda/SessionDialog';
import {
  type SessionDraft,
  emptySessionDraft,
  rowToDraft,
} from '@/features/admin/agenda/sessionDraft';
import { useAuth } from '@/features/auth/AuthContext';
import { useAdditionalGuests } from '@/features/guests/useAdditionalGuests';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import {
  type ProposalDraft,
  type ProposedSession,
  createProposal,
  deleteOwnProposal,
  updateOwnProposal,
} from './api';
import { FilterTab } from './FilterTab';
import { ProposalsList } from './ProposalsList';
import { SessionCard } from './SessionCard';
import { dayKey, groupSessionsByDay } from './grouping';
import { attendanceKey, loadSponsorGuestAttendance, setGuestAttendance } from './guestAttendance';
import { isGuestOptInSession } from './sessionRules';
import { useAgenda } from './useAgenda';
import { useProposals } from './useProposals';

type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];

interface Props {
  event: EventRow;
}

type FilterMode = 'all' | 'favorites' | 'proposed';

export function AgendaScreen({ event }: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const userId = user?.id ?? null;
  const [filter, setFilter] = useState<FilterMode>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [proposeDraft, setProposeDraft] = useState<SessionDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading, error, toggleFavorite } = useAgenda(event.id);
  const { proposals, vote, isVoting, refetch } = useProposals(event.id);
  const queryClient = useQueryClient();

  // Sponsors with additional_guests can opt those guests in/out of
  // audience='all' meal/social/activity sessions.
  const myGuests: ReadonlyArray<AdditionalGuestRow> = useAdditionalGuests(userId).data ?? [];
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
    const ok = await confirm({
      titleKey: 'agenda.proposals.deleteConfirm',
      titleValues: { title: proposal.title },
      destructive: true,
    });
    if (!ok) return;
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
