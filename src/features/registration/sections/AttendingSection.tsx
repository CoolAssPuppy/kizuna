import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { useAuth } from '@/features/auth/AuthContext';
import { useHydratedFormState } from '@/hooks/useHydratedFormState';
import { getSupabaseClient } from '@/lib/supabase';

import { saveAttending } from '../api/attending';
import type { RegistrationBundle } from '../types';
import { useRegistration } from '../useRegistration';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';

type YesNo = 'yes' | 'no' | null;

interface FormState {
  attending: YesNo;
  firstTime: YesNo;
}

const EMPTY: FormState = { attending: null, firstTime: null };

/**
 * Reads the saved attending answer off the registration bundle. The wizard
 * passes the bundle in via `mode.bundle`; profile mode looks it up by
 * active event. Either way, the form pre-fills with whatever's on file.
 */
function deriveFormState(bundle: RegistrationBundle | undefined): FormState {
  if (!bundle) return EMPTY;
  if (bundle.registration.status === 'cancelled') {
    return { attending: 'no', firstTime: null };
  }
  const task = bundle.tasks.find((t) => t.task_key === 'attending');
  if (task?.status === 'complete') {
    return {
      attending: 'yes',
      firstTime: bundle.registration.is_first_time_attendee ? 'yes' : 'no',
    };
  }
  return EMPTY;
}

export function AttendingSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const navigate = useNavigate();

  // Wizard mode hands us the bundle; profile mode fetches its own.
  const profileQuery = useRegistration({
    eventId: mode.kind === 'profile' ? (event?.id ?? null) : null,
  });
  const bundle = mode.kind === 'wizard' ? mode.bundle : profileQuery.data;
  const hydrated = mode.kind === 'wizard' ? true : profileQuery.data !== undefined;
  const [{ attending, firstTime }, setForm] = useHydratedFormState(
    hydrated,
    bundle,
    EMPTY,
    deriveFormState,
  );

  function setAttending(next: YesNo): void {
    // Clear the dependent answer when the gate flips so the user has to
    // re-answer it explicitly instead of carrying over a stale value.
    setForm((s) => ({ ...s, attending: next, firstTime: next === 'no' ? null : s.firstTime }));
  }
  function setFirstTime(next: YesNo): void {
    setForm((s) => ({ ...s, firstTime: next }));
  }

  // Save is enabled only when the user has answered every required question.
  // First-time is moot when the user is opting out.
  const submitDisabled = attending === null || (attending === 'yes' && firstTime === null);

  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Bespoke submit because the opt-out path navigates to '/' instead of
  // advancing to the next wizard step. useSectionSubmit's wizard branch
  // calls mode.onComplete() unconditionally, which would race the
  // navigate. Other sections use useSectionSubmit; this one can't.
  async function handleSubmit(): Promise<void> {
    if (submitDisabled || !user) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await saveAttending(getSupabaseClient(), {
        attending: attending === 'yes',
        firstTime: firstTime === 'yes',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registration'] }),
        queryClient.invalidateQueries({ queryKey: ['profile', 'checklist'] }),
      ]);
      show(t('profile.toast.attendingSaved'));

      if (attending === 'no') {
        if (mode.kind === 'wizard') navigate('/', { replace: true });
        return;
      }
      if (mode.kind === 'wizard') mode.onComplete();
    } catch (err) {
      console.error('[kizuna] saveAttending failed', err);
      show(t('profile.toast.error'), 'error');
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  const eventName = event?.name ?? t('registration.attending.fallbackEventName');

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.attending')}
      description={t('registration.attending.intro', { eventName })}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={() => void handleSubmit()}
      submitDisabled={submitDisabled}
    >
      <YesNoQuestion
        idPrefix="attending"
        legend={t('registration.attending.attendingPrompt', { eventName })}
        value={attending}
        onChange={setAttending}
        yesLabel={t('actions.yes')}
        noLabel={t('actions.no')}
      />

      {attending === 'yes' ? (
        <YesNoQuestion
          idPrefix="first-time"
          legend={t('registration.attending.firstTimePrompt')}
          value={firstTime}
          onChange={setFirstTime}
          yesLabel={t('actions.yes')}
          noLabel={t('actions.no')}
        />
      ) : null}

      {attending === 'no' ? (
        <p className="text-sm text-muted-foreground">{t('registration.attending.optOutNote')}</p>
      ) : null}
    </SectionChrome>
  );
}

interface YesNoQuestionProps {
  idPrefix: string;
  legend: string;
  value: YesNo;
  onChange: (next: 'yes' | 'no') => void;
  yesLabel: string;
  noLabel: string;
}

function YesNoQuestion({
  idPrefix,
  legend,
  value,
  onChange,
  yesLabel,
  noLabel,
}: YesNoQuestionProps): JSX.Element {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex gap-4 pt-1">
        {(['yes', 'no'] as const).map((option) => {
          const id = `${idPrefix}-${option}`;
          const checked = value === option;
          return (
            <label
              key={option}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                id={id}
                type="radio"
                name={idPrefix}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
              />
              {option === 'yes' ? yesLabel : noLabel}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
