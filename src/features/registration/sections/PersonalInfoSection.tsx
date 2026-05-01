import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadPersonalInfo, savePersonalInfo } from '../api';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

interface FormState {
  preferredName: string;
  legalName: string;
  baseCity: string;
}

const EMPTY: FormState = { preferredName: '', legalName: '', baseCity: '' };

export function PersonalInfoSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'personal_info',
    toastSuccessKey: 'profile.toast.personalInfoSaved',
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const row = await loadPersonalInfo(getSupabaseClient(), user.id);
      if (!active) return;
      setValues({
        preferredName: row?.preferred_name ?? '',
        legalName: row?.legal_name ?? '',
        baseCity: row?.base_city ?? '',
      });
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function handleSubmit(): void {
    if (!user) return;
    void submit(() =>
      savePersonalInfo(getSupabaseClient(), user.id, {
        preferred_name: values.preferredName,
        legal_name: values.legalName,
        base_city: values.baseCity,
      }),
    );
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.personalInfo')}
      {...(mode.kind === 'profile' ? { description: t('profile.cards.personalInfo') } : {})}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="personal-preferred">{t('registration.personalInfo.preferredName')}</Label>
        <Input
          id="personal-preferred"
          required
          value={values.preferredName}
          onChange={(e) => setValues((v) => ({ ...v, preferredName: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.preferredNameHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="personal-legal">{t('registration.personalInfo.legalName')}</Label>
        <Input
          id="personal-legal"
          required
          value={values.legalName}
          onChange={(e) => setValues((v) => ({ ...v, legalName: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.legalNameHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="personal-city">{t('registration.personalInfo.baseCity')}</Label>
        <Input
          id="personal-city"
          required
          value={values.baseCity}
          onChange={(e) => setValues((v) => ({ ...v, baseCity: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.baseCityHint')}
        </p>
      </div>
    </SectionChrome>
  );
}
