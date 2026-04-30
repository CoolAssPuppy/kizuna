import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { loadPersonalInfo, savePersonalInfo } from '@/features/registration/api';
import { getSupabaseClient } from '@/lib/supabase';

interface FormState {
  preferredName: string;
  legalName: string;
  baseCity: string;
}

const EMPTY: FormState = { preferredName: '', legalName: '', baseCity: '' };

export function PersonalInfoCard(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { show } = useToast();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function handleSave(): Promise<void> {
    if (!user) return;
    setBusy(true);
    try {
      await savePersonalInfo(getSupabaseClient(), user.id, {
        preferred_name: values.preferredName,
        legal_name: values.legalName,
        base_city: values.baseCity,
      });
      show(t('profile.toast.personalInfoSaved'));
    } catch {
      show(t('profile.toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell
      title={t('registration.steps.personalInfo')}
      description={t('profile.cards.personalInfo')}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-preferred">{t('registration.personalInfo.preferredName')}</Label>
          <Input
            id="profile-preferred"
            value={values.preferredName}
            onChange={(e) => setValues((v) => ({ ...v, preferredName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-legal">{t('registration.personalInfo.legalName')}</Label>
          <Input
            id="profile-legal"
            value={values.legalName}
            onChange={(e) => setValues((v) => ({ ...v, legalName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-city">{t('registration.personalInfo.baseCity')}</Label>
          <Input
            id="profile-city"
            value={values.baseCity}
            onChange={(e) => setValues((v) => ({ ...v, baseCity: e.target.value }))}
          />
        </div>
        <Button onClick={() => void handleSave()} disabled={busy || !hydrated}>
          {busy ? t('registration.saving') : t('actions.save')}
        </Button>
      </div>
    </CardShell>
  );
}
