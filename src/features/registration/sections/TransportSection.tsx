import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';

import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

/**
 * Phase-1 transport section: the attendee tells us whether they need an
 * airport transfer. The actual transport_requests row is created by admin
 * tooling once Perk syncs flights — see M5/M8.
 */
export function TransportSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [needsTransfer, setNeedsTransfer] = useState<boolean | null>(null);
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'transport',
    toastSuccessKey: 'profile.toast.transportSaved',
  });

  function handleSubmit(): void {
    if (!user || needsTransfer === null) return;
    // Marking the task complete acknowledges the attendee's stated preference;
    // there is no transport_requests row to write at this stage.
    void submit(() => Promise.resolve());
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.transport')}
      description={t('registration.transport.intro')}
      busy={busy}
      hydrated
      errorKey={errorKey}
      onSubmit={handleSubmit}
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
    </SectionChrome>
  );
}
