import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, CreditCard, Mail, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import {
  cancelGuestInvitation,
  listAdditionalGuests,
  listGuestInvitations,
  removeAdditionalGuest,
  renameAdditionalGuest,
  updateGuestInvitation,
} from '@/features/guests/api';
import type { GuestInvitationRow } from '@/features/guests/types';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { computeGuestFeeTotal } from './guestFees';
import { CURRENCY_FMT } from './guests/currency';
import { EditInvitationDialog } from './guests/EditInvitationDialog';
import { InviteGuestDialog } from './guests/InviteGuestDialog';
import { PayFeesDialog } from './guests/PayFeesDialog';
import { RenameMinorDialog } from './guests/RenameMinorDialog';
import type { SectionProps } from './types';

const STATUS_TONE: Record<GuestInvitationRow['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-700',
  sent: 'bg-blue-500/10 text-blue-700',
  accepted: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

export function GuestsSection(_props: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [editTarget, setEditTarget] = useState<GuestInvitationRow | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const { data: invitations } = useQuery({
    queryKey: ['guest-invitations', user?.id ?? null],
    enabled: !!user,
    queryFn: () =>
      user ? listGuestInvitations(getSupabaseClient(), user.id) : Promise.resolve([]),
  });
  const { data: minors } = useQuery({
    queryKey: ['additional-guests', user?.id ?? null],
    enabled: !!user,
    queryFn: () =>
      user ? listAdditionalGuests(getSupabaseClient(), user.id) : Promise.resolve([]),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelGuestInvitation(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guest-invitations'] });
      show(t('registration.guests.cancelled'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const removeMinor = useMutation({
    mutationFn: (id: string) => removeAdditionalGuest(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['additional-guests'] });
      show(t('registration.guests.minorRemoved'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const renameMinor = useMutation({
    mutationFn: (args: { id: string; fullName: string }) =>
      renameAdditionalGuest(getSupabaseClient(), args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['additional-guests'] });
      show(t('registration.guests.minorRenamed'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const editInvite = useMutation({
    mutationFn: (args: { id: string; fullName: string; guestEmail: string }) =>
      updateGuestInvitation(getSupabaseClient(), args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guest-invitations'] });
      show(t('registration.guests.invitationUpdated'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const adultList = invitations ?? [];
  const minorList = minors ?? [];
  const total = computeGuestFeeTotal(adultList, minorList);

  return (
    <CardShell
      title={t('registration.steps.guests')}
      description={t('registration.guests.intro')}
      actions={
        <Button type="button" size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Mail aria-hidden className="h-4 w-4" />
          {t('registration.guests.invite')}
        </Button>
      }
    >
      {adultList.length === 0 && minorList.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('registration.guests.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {adultList.length > 0 && (
            <ul className="space-y-2">
              {adultList.map((inv) => {
                // Editable while the row hasn't become an account yet.
                // Cancellable from pending or sent (sponsor can rescind
                // before the guest accepts).
                const editable =
                  inv.status === 'pending' ||
                  inv.status === 'sent' ||
                  inv.status === 'expired' ||
                  inv.status === 'cancelled';
                const cancellable = inv.status === 'pending' || inv.status === 'sent';
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-card p-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium">
                        {inv.full_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {inv.guest_email}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('registration.guests.invitedAt', {
                          date: mediumDateFormatter.format(new Date(inv.sent_at)),
                        })}
                        {' · '}
                        {CURRENCY_FMT.format(Number(inv.fee_amount))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          STATUS_TONE[inv.status],
                        )}
                      >
                        {t(`registration.guests.statuses.${inv.status}`)}
                      </span>
                      {editable ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={t('registration.guests.editInvitation')}
                          onClick={() => setEditTarget(inv)}
                        >
                          <Pencil aria-hidden className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {cancellable ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={t('registration.guests.cancel')}
                          onClick={() => cancel.mutate(inv.id)}
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {minorList.length > 0 && (
            <ul className="space-y-2">
              {minorList.map((minor) => (
                <li
                  key={minor.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-card p-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Baby aria-hidden className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">{minor.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`registration.guests.brackets.${minor.age_bracket}`)}
                        {' · '}
                        {CURRENCY_FMT.format(Number(minor.fee_amount))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t('registration.guests.renameMinor')}
                      onClick={() => setRenameTarget({ id: minor.id, fullName: minor.full_name })}
                    >
                      <Pencil aria-hidden className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t('registration.guests.removeMinor')}
                      onClick={() => {
                        if (
                          confirm(
                            t('registration.guests.confirmRemoveMinor', { name: minor.full_name }),
                          )
                        ) {
                          removeMinor.mutate(minor.id);
                        }
                      }}
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('registration.guests.totalLabel')}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{CURRENCY_FMT.format(total)}</p>
            <p className="text-xs text-muted-foreground">{t('registration.guests.totalHint')}</p>
          </div>
          <Button type="button" className="gap-2" onClick={() => setPayOpen(true)}>
            <CreditCard aria-hidden className="h-4 w-4" />
            {t('registration.guests.payFees')}
          </Button>
        </div>
      ) : null}

      <InviteGuestDialog open={open} onClose={() => setOpen(false)} />
      <RenameMinorDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={(payload) => renameMinor.mutate(payload)}
      />
      <EditInvitationDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(payload) => editInvite.mutate(payload)}
      />
      <PayFeesDialog open={payOpen} onClose={() => setPayOpen(false)} amount={total} />
    </CardShell>
  );
}
