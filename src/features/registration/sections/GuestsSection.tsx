import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, Mail, Trash2 } from 'lucide-react';
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
  inviteGuest,
  listAdditionalGuests,
  listGuestInvitations,
} from '@/features/guests/api';
import type {
  AdditionalGuestRow,
  GuestAgeBracket,
  GuestInvitationRow,
} from '@/features/guests/types';
import { GUEST_FEE_FOR_BRACKET } from '@/features/guests/types';
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

const CURRENCY_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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

  const adultList = invitations ?? [];
  const minorList = minors ?? [];
  const total = computeTotal(adultList, minorList);

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
      <p className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
        {t('registration.guests.totalDue', { amount: CURRENCY_FMT.format(total) })}
      </p>

      {adultList.length === 0 && minorList.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('registration.guests.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {adultList.length > 0 && (
            <ul className="space-y-2">
              {adultList.map((inv) => (
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <InviteDialog open={open} onClose={() => setOpen(false)} />
    </CardShell>
  );
}

function computeTotal(
  invitations: ReadonlyArray<GuestInvitationRow>,
  minors: ReadonlyArray<AdditionalGuestRow>,
): number {
  return (
    invitations
      .filter((i) => i.status !== 'cancelled')
      .reduce((sum, i) => sum + Number(i.fee_amount), 0) +
    minors.reduce((sum, m) => sum + Number(m.fee_amount), 0)
  );
}

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'bracket' | 'details';

function InviteDialog({ open, onClose }: InviteDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('bracket');
  const [bracket, setBracket] = useState<GuestAgeBracket | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  function reset(): void {
    setStep('bracket');
    setBracket(null);
    setFirstName('');
    setLastName('');
    setEmail('');
  }

  const invite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user');
      if (!bracket) throw new Error('No bracket');
      return inviteGuest(
        { client: getSupabaseClient() },
        {
          ageBracket: bracket,
          fullName,
          ...(bracket === 'adult' ? { guestEmail: email.trim() } : {}),
        },
      );
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: result.kind === 'adult' ? ['guest-invitations'] : ['additional-guests'],
      });
      show(
        result.kind === 'adult'
          ? t('registration.guests.invited', { email })
          : t('registration.guests.minorAdded', { name: fullName }),
      );
      reset();
      onClose();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const namesValid = firstName.trim().length >= 1 && lastName.trim().length >= 1;
  const adultDetailsValid =
    bracket === 'adult' ? namesValid && email.trim().includes('@') : namesValid;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('registration.guests.inviteTitle')}</DialogTitle>
        </DialogHeader>
        {step === 'bracket' ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('registration.guests.bracketIntro')}</p>
            <div className="space-y-2">
              {(['adult', 'teen', 'under_12'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setBracket(option);
                    setStep('details');
                  }}
                  className="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      {t(`registration.guests.brackets.${option}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`registration.guests.bracketHints.${option}`)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {CURRENCY_FMT.format(GUEST_FEE_FOR_BRACKET[option])}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate();
            }}
          >
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {bracket === 'adult'
                  ? t('registration.guests.detailsIntroAdult')
                  : t('registration.guests.detailsIntroMinor')}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-first-name">{t('registration.guests.firstName')}</Label>
                  <Input
                    id="invite-first-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('registration.guests.firstNamePlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-last-name">{t('registration.guests.lastName')}</Label>
                  <Input
                    id="invite-last-name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('registration.guests.lastNamePlaceholder')}
                  />
                </div>
              </div>
              {bracket === 'adult' ? (
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
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStep('bracket')}>
                {t('actions.back')}
              </Button>
              <Button type="submit" disabled={invite.isPending || !adultDetailsValid}>
                {invite.isPending
                  ? t('registration.guests.sending')
                  : bracket === 'adult'
                    ? t('registration.guests.send')
                    : t('registration.guests.addMinor')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
