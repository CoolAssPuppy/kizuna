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
import { useToast } from '@/components/ui/toast';
import { callEdgeFunction } from '@/lib/edgeFunction';
import { getSupabaseClient } from '@/lib/supabase';

import { CURRENCY_FMT } from './currency';

interface PayFeesDialogProps {
  open: boolean;
  onClose: () => void;
  amount: number;
}

interface CheckoutResponse {
  url: string;
  sessionId: string;
}

/**
 * Sponsor-side fees checkout. Bundles every pending guest_invitation
 * and additional_guests row for the calling user into a single Stripe
 * Checkout session. The webhook handles the fan-out (flip statuses,
 * dispatch invite emails). When STRIPE_SECRET_KEY is missing the edge
 * function returns a stubbed success URL so the local flow still
 * exercises the redirect.
 */
export function PayFeesDialog({ open, onClose, amount }: PayFeesDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function handlePay(): Promise<void> {
    if (busy || amount <= 0) return;
    setBusy(true);
    try {
      const result = await callEdgeFunction<CheckoutResponse>(
        getSupabaseClient(),
        'create-sponsor-fees-checkout',
        {},
      );
      window.location.href = result.url;
    } catch (err) {
      show(err instanceof Error ? err.message : 'Error', 'error');
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('registration.guests.payTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            {t('registration.guests.payAmount', { amount: CURRENCY_FMT.format(amount) })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('registration.guests.payHint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={() => void handlePay()} disabled={busy || amount <= 0}>
            {busy ? t('registration.guests.paying') : t('registration.guests.payNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
