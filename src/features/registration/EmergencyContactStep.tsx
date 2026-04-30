import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadEmergencyContact, markTaskComplete, saveEmergencyContact } from './api';
import { StepShell } from './StepShell';
import type { RegistrationBundle } from './types';

interface Props {
  bundle: RegistrationBundle;
  onComplete: () => void;
}

interface FormState {
  fullName: string;
  relationship: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
  notes: string;
}

const EMPTY: FormState = {
  fullName: '',
  relationship: '',
  phonePrimary: '',
  phoneSecondary: '',
  email: '',
  notes: '',
};

export function EmergencyContactStep({ bundle, onComplete }: Props): JSX.Element {
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
      const row = await loadEmergencyContact(getSupabaseClient(), user.id);
      if (!active) return;
      setValues(
        row
          ? {
              fullName: row.full_name,
              relationship: row.relationship,
              phonePrimary: row.phone_primary,
              phoneSecondary: row.phone_secondary ?? '',
              email: row.email ?? '',
              notes: row.notes ?? '',
            }
          : EMPTY,
      );
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
      await saveEmergencyContact(getSupabaseClient(), user.id, {
        full_name: values.fullName,
        relationship: values.relationship,
        phone_primary: values.phonePrimary,
        phone_secondary: values.phoneSecondary.trim() || null,
        email: values.email.trim() || null,
        notes: values.notes.trim() || null,
      });
      await markTaskComplete(getSupabaseClient(), bundle.registration.id, 'emergency_contact');
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title={t('registration.steps.emergencyContact')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={!hydrated}
    >
      <div className="space-y-2">
        <Label htmlFor="ec-full-name">{t('registration.emergencyContact.fullName')}</Label>
        <Input
          id="ec-full-name"
          required
          value={values.fullName}
          onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-relationship">{t('registration.emergencyContact.relationship')}</Label>
        <Input
          id="ec-relationship"
          required
          value={values.relationship}
          onChange={(e) => setValues((v) => ({ ...v, relationship: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-phone-primary">{t('registration.emergencyContact.phonePrimary')}</Label>
        <Input
          id="ec-phone-primary"
          type="tel"
          inputMode="tel"
          required
          value={values.phonePrimary}
          onChange={(e) => setValues((v) => ({ ...v, phonePrimary: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t('registration.emergencyContact.phonePrimaryHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-phone-secondary">
          {t('registration.emergencyContact.phoneSecondary')}
        </Label>
        <Input
          id="ec-phone-secondary"
          type="tel"
          inputMode="tel"
          value={values.phoneSecondary}
          onChange={(e) => setValues((v) => ({ ...v, phoneSecondary: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-email">{t('registration.emergencyContact.email')}</Label>
        <Input
          id="ec-email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ec-notes">{t('registration.emergencyContact.notes')}</Label>
        <Textarea
          id="ec-notes"
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </div>
    </StepShell>
  );
}
