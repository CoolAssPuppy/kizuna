import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadEmergencyContact, saveEmergencyContact } from '../api';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

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

export function EmergencyContactSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: row, isSuccess: hydrated } = useQuery({
    queryKey: ['emergency-contact', user?.id ?? null],
    enabled: !!user,
    queryFn: () => loadEmergencyContact(getSupabaseClient(), user!.id),
  });
  const [values, setValues] = useState<FormState>(EMPTY);
  const [synced, setSynced] = useState(false);
  if (!synced && hydrated) {
    setSynced(true);
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
  }
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'emergency_contact',
    toastSuccessKey: 'profile.toast.emergencyContactSaved',
  });

  function handleSubmit(): void {
    if (!user) return;
    void submit(() =>
      saveEmergencyContact(getSupabaseClient(), user.id, {
        full_name: values.fullName,
        relationship: values.relationship,
        phone_primary: values.phonePrimary,
        phone_secondary: values.phoneSecondary.trim() || null,
        email: values.email.trim() || null,
        notes: values.notes.trim() || null,
      }),
    );
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.emergencyContact')}
      {...(mode.kind === 'profile' ? { description: t('profile.cards.emergencyContact') } : {})}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
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
    </SectionChrome>
  );
}
