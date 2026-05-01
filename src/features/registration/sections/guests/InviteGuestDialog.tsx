import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { inviteGuest } from '@/features/guests/api';
import type { GuestAgeBracket } from '@/features/guests/types';
import { GUEST_FEE_FOR_BRACKET } from '@/features/guests/types';
import { getSupabaseClient } from '@/lib/supabase';

import { CURRENCY_FMT } from './currency';

type Step = 'bracket' | 'details';

interface InviteGuestDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Two-step invite flow: pick an age bracket, then capture name (and
 * email if adult). The bracket is locked at creation because it drives
 * the captured fee_amount — re-quoting later would put the sponsor and
 * Stripe out of sync.
 */
export function InviteGuestDialog({ open, onClose }: InviteGuestDialogProps): JSX.Element {
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
