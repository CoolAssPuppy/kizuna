import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadPersonalInfo, markTaskComplete, savePersonalInfo } from './api';
import { StepShell } from './StepShell';
import type { RegistrationBundle } from './types';

interface PersonalInfoStepProps {
  bundle: RegistrationBundle;
  onComplete: () => void;
}

interface FormState {
  preferredName: string;
  legalName: string;
  baseCity: string;
}

const EMPTY: FormState = { preferredName: '', legalName: '', baseCity: '' };

export function PersonalInfoStep({ bundle, onComplete }: PersonalInfoStepProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const profile = await loadPersonalInfo(getSupabaseClient(), user.id);
      if (!active) return;
      setValues({
        preferredName: profile?.preferred_name ?? '',
        legalName: profile?.legal_name ?? '',
        baseCity: profile?.base_city ?? '',
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
      await savePersonalInfo(getSupabaseClient(), user.id, {
        preferred_name: values.preferredName,
        legal_name: values.legalName,
        base_city: values.baseCity,
      });
      await markTaskComplete(getSupabaseClient(), bundle.registration.id, 'personal_info');
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title={t('registration.steps.personalInfo')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={!hydrated}
    >
      <div className="space-y-2">
        <Label htmlFor="preferred-name">{t('registration.personalInfo.preferredName')}</Label>
        <Input
          id="preferred-name"
          required
          value={values.preferredName}
          onChange={(e) => setValues((v) => ({ ...v, preferredName: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.preferredNameHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-name">{t('registration.personalInfo.legalName')}</Label>
        <Input
          id="legal-name"
          required
          value={values.legalName}
          onChange={(e) => setValues((v) => ({ ...v, legalName: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.legalNameHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="base-city">{t('registration.personalInfo.baseCity')}</Label>
        <Input
          id="base-city"
          required
          value={values.baseCity}
          onChange={(e) => setValues((v) => ({ ...v, baseCity: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.baseCityHint')}
        </p>
      </div>
    </StepShell>
  );
}
