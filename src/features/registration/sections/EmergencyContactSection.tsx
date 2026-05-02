import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useActiveSubject } from '@/features/profile/useActiveSubject';
import { joinFullName, splitFullName } from '@/lib/fullName';
import { getSupabaseClient } from '@/lib/supabase';

import { loadEmergencyContact, saveEmergencyContact } from '../api';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useHydratedFormState } from '@/hooks/useHydratedFormState';
import { useSectionSubmit } from './useSectionSubmit';

interface FormState {
  firstName: string;
  lastName: string;
  relationship: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
  notes: string;
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  relationship: '',
  phonePrimary: '',
  phoneSecondary: '',
  email: '',
  notes: '',
};

export function EmergencyContactSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const subject = useActiveSubject();
  const { data: row, isSuccess: hydrated } = useQuery({
    queryKey: ['emergency-contact', subject.userId],
    enabled: !!subject.userId,
    queryFn: () => loadEmergencyContact(getSupabaseClient(), subject.userId),
  });
  const [values, setValues] = useHydratedFormState(hydrated, row, EMPTY, (loaded) => {
    if (!loaded) return EMPTY;
    const split = splitFullName(loaded.full_name);
    return {
      firstName: split.first,
      lastName: split.last,
      relationship: loaded.relationship,
      phonePrimary: loaded.phone_primary,
      phoneSecondary: loaded.phone_secondary ?? '',
      email: loaded.email ?? '',
      notes: loaded.notes ?? '',
    };
  });
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'emergency_contact',
    toastSuccessKey: 'profile.toast.emergencyContactSaved',
    invalidateQueryKeys: [['emergency-contact', subject.userId]],
  });

  function handleSubmit(): void {
    if (!subject.userId) return;
    void submit(() =>
      saveEmergencyContact(getSupabaseClient(), subject.userId, {
        full_name: joinFullName(values.firstName, values.lastName),
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ec-first-name">{t('registration.emergencyContact.firstName')}</Label>
          <Input
            id="ec-first-name"
            required
            value={values.firstName}
            onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ec-last-name">{t('registration.emergencyContact.lastName')}</Label>
          <Input
            id="ec-last-name"
            required
            value={values.lastName}
            onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
          />
        </div>
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
