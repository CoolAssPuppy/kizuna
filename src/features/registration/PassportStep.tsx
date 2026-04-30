import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { loadPassportMetadata, markTaskComplete, savePassport } from './api';
import { isExpiryRiskyForEvent } from './expiryWarning';
import { StepShell } from './StepShell';
import type { RegistrationBundle } from './types';

interface Props {
  bundle: RegistrationBundle;
  onComplete: () => void;
}

interface FormState {
  passportName: string;
  passportNumber: string;
  issuingCountry: string;
  expiryDate: string;
}

const EMPTY: FormState = {
  passportName: '',
  passportNumber: '',
  issuingCountry: '',
  expiryDate: '',
};

export function PassportStep({ bundle, onComplete }: Props): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const meta = await loadPassportMetadata(getSupabaseClient(), user.id);
      if (!active) return;
      setValues({
        passportName: meta?.passport_name ?? '',
        // The number is encrypted; we never read it back. Leave empty so the
        // user must re-enter when correcting.
        passportNumber: '',
        issuingCountry: meta?.issuing_country ?? '',
        expiryDate: meta?.expiry_date ?? '',
      });
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleSubmit(): Promise<void> {
    if (!user) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await savePassport(getSupabaseClient(), user.id, {
        passportName: values.passportName,
        passportNumber: values.passportNumber,
        issuingCountry: values.issuingCountry.toUpperCase(),
        expiryDate: values.expiryDate,
      });
      await markTaskComplete(getSupabaseClient(), bundle.registration.id, 'passport');
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  const showWarning = isExpiryRiskyForEvent(values.expiryDate, event?.end_date);

  return (
    <StepShell
      title={t('registration.steps.passport')}
      subtitle={t('registration.passport.intro')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={!hydrated}
    >
      <div className="space-y-2">
        <Label htmlFor="passport-name">{t('registration.passport.passportName')}</Label>
        <Input
          id="passport-name"
          required
          value={values.passportName}
          onChange={(e) => setValues((v) => ({ ...v, passportName: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="passport-number">{t('registration.passport.passportNumber')}</Label>
        <Input
          id="passport-number"
          required
          autoComplete="off"
          value={values.passportNumber}
          onChange={(e) => setValues((v) => ({ ...v, passportNumber: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.passport.passportNumberHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="issuing-country">{t('registration.passport.issuingCountry')}</Label>
        <Input
          id="issuing-country"
          required
          maxLength={2}
          value={values.issuingCountry}
          onChange={(e) => setValues((v) => ({ ...v, issuingCountry: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.passport.issuingCountryHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expiry-date">{t('registration.passport.expiryDate')}</Label>
        <Input
          id="expiry-date"
          type="date"
          required
          value={values.expiryDate}
          onChange={(e) => setValues((v) => ({ ...v, expiryDate: e.target.value }))}
        />
        {showWarning ? (
          <p role="status" className="text-sm font-medium text-destructive">
            {t('registration.passport.expiryWarning')}
          </p>
        ) : null}
      </div>
    </StepShell>
  );
}
