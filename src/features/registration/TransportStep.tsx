import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { markTaskComplete } from './api';
import { StepShell } from './StepShell';
import type { RegistrationBundle } from './types';

interface Props {
  bundle: RegistrationBundle;
  onComplete: () => void;
}

/**
 * Lightweight Phase-1 transport step: the attendee tells us whether they
 * need an airport transfer. The actual transport_requests row is created by
 * admin tooling once Perk syncs flights — see M5/M8.
 */
export function TransportStep({ bundle, onComplete }: Props): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [needsTransfer, setNeedsTransfer] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    if (!user || needsTransfer === null) return;
    setBusy(true);
    setErrorKey(null);
    try {
      // The actual transport_requests row is materialised once Perk syncs
      // a flight for this user. Marking the task complete acknowledges the
      // attendee has stated their preference.
      await markTaskComplete(getSupabaseClient(), bundle.registration.id, 'transport');
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title={t('registration.steps.transport')}
      subtitle={t('registration.transport.intro')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={needsTransfer === null}
    >
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="transport"
            className="h-4 w-4 accent-primary"
            checked={needsTransfer === true}
            onChange={() => setNeedsTransfer(true)}
          />
          {t('registration.transport.needsTransfer')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="transport"
            className="h-4 w-4 accent-primary"
            checked={needsTransfer === false}
            onChange={() => setNeedsTransfer(false)}
          />
          {t('registration.transport.selfArranging')}
        </label>
      </div>
    </StepShell>
  );
}
