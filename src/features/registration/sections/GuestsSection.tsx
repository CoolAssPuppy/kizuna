import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import {
  cancelGuestInvitation,
  createGuestInvitation,
  listGuestInvitations,
} from '@/features/guests/api';
import type { GuestInvitationRow } from '@/features/guests/types';
import { mediumDateFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import type { SectionProps } from './types';

const STATUS_TONE: Record<GuestInvitationRow['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-700',
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

  const { data: invitations } = useQuery({
    queryKey: ['guest-invitations', user?.id ?? null],
    enabled: !!user,
    queryFn: () =>
      user ? listGuestInvitations(getSupabaseClient(), user.id) : Promise.resolve([]),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelGuestInvitation(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guest-invitations'] });
      show(t('registration.guests.cancelled'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const list = invitations ?? [];

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
      {list.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('registration.guests.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-card p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">{inv.guest_email}</p>
                <p className="text-xs text-muted-foreground">
                  {t('registration.guests.invitedAt', {
                    date: mediumDateFormatter.format(new Date(inv.sent_at)),
                  })}
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
                {inv.status === 'pending' ? (
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
          ))}
        </ul>
      )}

      <InviteDialog open={open} onClose={() => setOpen(false)} />
    </CardShell>
  );
}

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

function InviteDialog({ open, onClose }: InviteDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');

  const invite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user');
      return createGuestInvitation(
        { client: getSupabaseClient() },
        { guestEmail: email.trim(), sponsorUserId: user.id },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guest-invitations'] });
      show(t('registration.guests.invited', { email }));
      setEmail('');
      onClose();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('registration.guests.inviteTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t('registration.guests.inviteBody')}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t('registration.guests.guestEmail')}</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('registration.guests.emailPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={invite.isPending || !email.trim()}>
              {invite.isPending
                ? t('registration.guests.sending')
                : t('registration.guests.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
