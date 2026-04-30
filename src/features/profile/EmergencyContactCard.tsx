import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { loadEmergencyContact, saveEmergencyContact } from '@/features/registration/api';
import { getSupabaseClient } from '@/lib/supabase';

interface FormState {
  fullName: string;
  relationship: string;
  phonePrimary: string;
  email: string;
}

const EMPTY: FormState = { fullName: '', relationship: '', phonePrimary: '', email: '' };

export function EmergencyContactCard(): JSX.Element {
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
      const row = await loadEmergencyContact(getSupabaseClient(), user.id);
      if (!active) return;
      setValues({
        fullName: row?.full_name ?? '',
        relationship: row?.relationship ?? '',
        phonePrimary: row?.phone_primary ?? '',
        email: row?.email ?? '',
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
      await saveEmergencyContact(getSupabaseClient(), user.id, {
        full_name: values.fullName,
        relationship: values.relationship,
        phone_primary: values.phonePrimary,
        phone_secondary: null,
        email: values.email.trim() || null,
        notes: null,
      });
      show(t('profile.toast.emergencyContactSaved'));
    } catch {
      show(t('profile.toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell
      title={t('registration.steps.emergencyContact')}
      description={t('profile.cards.emergencyContact')}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-ec-name">{t('registration.emergencyContact.fullName')}</Label>
          <Input
            id="profile-ec-name"
            value={values.fullName}
            onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-ec-rel">{t('registration.emergencyContact.relationship')}</Label>
          <Input
            id="profile-ec-rel"
            value={values.relationship}
            onChange={(e) => setValues((v) => ({ ...v, relationship: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-ec-phone">
            {t('registration.emergencyContact.phonePrimary')}
          </Label>
          <Input
            id="profile-ec-phone"
            type="tel"
            value={values.phonePrimary}
            onChange={(e) => setValues((v) => ({ ...v, phonePrimary: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-ec-email">{t('registration.emergencyContact.email')}</Label>
          <Input
            id="profile-ec-email"
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          />
        </div>
        <Button onClick={() => void handleSave()} disabled={busy || !hydrated}>
          {busy ? t('registration.saving') : t('actions.save')}
        </Button>
      </div>
    </CardShell>
  );
}
