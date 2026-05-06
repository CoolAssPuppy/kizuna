import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';

import { deleteInvitation, listInvitations } from './api';
import { InviteAttendeeDialog } from './InviteAttendeeDialog';

/**
 * Admin → Invitations. Surfaces:
 *   - When the event is open-to-domains: an explainer that points at
 *     About → Allowed domains, since the table-driven flow doesn't
 *     apply.
 *   - When invite-only: the InviteAttendeeDialog above and a paginated
 *     table of invited rows below with per-row delete.
 */
export function InvitationsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const { show } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const eventId = event?.id ?? null;

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['admin', 'invitations', eventId],
    enabled: eventId !== null,
    queryFn: () => (eventId ? listInvitations(getSupabaseClient(), eventId) : Promise.resolve([])),
  });

  const remove = useMutation({
    mutationFn: async (email: string) => {
      if (!eventId) throw new Error('no_active_event');
      await deleteInvitation(getSupabaseClient(), { eventId, email });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'invitations', eventId] });
      show(t('admin.invitations.deleted'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!event) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }

  if (event.invite_all_employees) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.invitations.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.invitations.subtitle')}</p>
        </header>
        <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm">
          <p className="font-medium">{t('admin.invitations.openToAll.title')}</p>
          <p className="text-muted-foreground">
            {t('admin.invitations.openToAll.body', {
              domains:
                (event.allowed_domains ?? []).join(', ') ||
                t('admin.invitations.openToAll.noDomains'),
            })}
          </p>
          <Link to="/admin/about" className="text-sm underline">
            {t('admin.invitations.openToAll.editLink')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.invitations.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.invitations.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus aria-hidden className="h-4 w-4" />
          {t('admin.invitations.invite')}
        </Button>
      </header>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>
      ) : invitations.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          {t('admin.invitations.empty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {invitations.map((row) => (
            <li
              key={row.email}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-medium">{row.email}</p>
                <p className="text-xs text-muted-foreground">
                  {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                  {row.created_at
                    ? ` · ${mediumDateFormatter.format(new Date(row.created_at))}`
                    : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void (async () => {
                    if (
                      await confirm({
                        titleKey: 'admin.invitations.deleteConfirm',
                        titleValues: { email: row.email },
                        destructive: true,
                      })
                    ) {
                      remove.mutate(row.email);
                    }
                  })();
                }}
                aria-label={t('admin.invitations.deleteAria', { email: row.email })}
              >
                <Trash2 aria-hidden className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <InviteAttendeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={event.id}
        existingEmails={invitations.map((row) => row.email)}
        onAdded={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'invitations', eventId] });
        }}
      />
    </section>
  );
}
