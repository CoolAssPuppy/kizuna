import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { loadPassportMetadata, savePassport } from '../api';
import { isExpiryRiskyForEvent } from '../expiryWarning';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useHydratedFormState } from './useHydratedFormState';
import { useSectionSubmit } from './useSectionSubmit';

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

export function PassportSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const { data: meta, isSuccess: hydrated } = useQuery({
    queryKey: ['passport-metadata', user?.id ?? null],
    enabled: !!user,
    queryFn: () => loadPassportMetadata(getSupabaseClient(), user!.id),
  });
  const [values, setValues] = useHydratedFormState(hydrated, meta, EMPTY, (row) => ({
    passportName: row?.passport_name ?? '',
    // The number is encrypted at rest and never returned. Leave blank so
    // the user must re-enter it when correcting any field.
    passportNumber: '',
    issuingCountry: row?.issuing_country ?? '',
    expiryDate: row?.expiry_date ?? '',
  }));
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'passport',
    toastSuccessKey: 'profile.toast.passportSaved',
  });

  // The set_passport RPC takes p_expiry_date as a NOT-NULL `date`, so an
  // empty string from the date input gets rejected by Postgres with
  // 22007 (invalid input syntax for type date). Gate Save on every
  // required field rather than letting a 400 echo back as an error toast.
  const submitDisabled =
    !values.passportName.trim() ||
    !values.passportNumber.trim() ||
    values.issuingCountry.trim().length !== 2 ||
    !values.expiryDate;

  function handleSubmit(): void {
    if (!user || submitDisabled) return;
    void submit(() =>
      savePassport(getSupabaseClient(), user.id, {
        passportName: values.passportName,
        passportNumber: values.passportNumber,
        issuingCountry: values.issuingCountry.toUpperCase(),
        expiryDate: values.expiryDate,
      }),
    );
  }

  const showWarning = isExpiryRiskyForEvent(values.expiryDate, event?.end_date);

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.passport')}
      description={t('registration.passport.intro')}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
      submitDisabled={submitDisabled}
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
    </SectionChrome>
  );
}
