import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { composeLegalName, loadPersonalInfo, savePersonalInfo } from '../api';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useHydratedFormState } from '@/hooks/useHydratedFormState';
import { useSectionSubmit } from './useSectionSubmit';

interface FormState {
  preferredName: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  alternateEmail: string;
  phoneNumber: string;
  whatsapp: string;
  baseCity: string;
}

const EMPTY: FormState = {
  preferredName: '',
  firstName: '',
  middleInitial: '',
  lastName: '',
  alternateEmail: '',
  phoneNumber: '',
  whatsapp: '',
  baseCity: '',
};

export function PersonalInfoSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: row, isSuccess: hydrated } = useQuery({
    queryKey: ['personal-info', user?.id ?? null],
    enabled: !!user,
    queryFn: () => loadPersonalInfo(getSupabaseClient(), user!.id),
  });
  const [values, setValues] = useHydratedFormState(hydrated, row, EMPTY, (loaded) => ({
    preferredName: loaded?.preferred_name ?? '',
    firstName: loaded?.first_name ?? '',
    middleInitial: loaded?.middle_initial ?? '',
    lastName: loaded?.last_name ?? '',
    alternateEmail: loaded?.alternate_email ?? '',
    phoneNumber: loaded?.phone_number ?? '',
    whatsapp: loaded?.whatsapp ?? '',
    baseCity: loaded?.base_city ?? '',
  }));
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'personal_info',
    toastSuccessKey: 'profile.toast.personalInfoSaved',
    invalidateQueryKeys: [['personal-info', user?.id ?? null]],
  });

  const legalName = useMemo(
    () =>
      composeLegalName({
        first_name: values.firstName || null,
        middle_initial: values.middleInitial || null,
        last_name: values.lastName || null,
      }),
    [values.firstName, values.middleInitial, values.lastName],
  );

  function handleSubmit(): void {
    if (!user) return;
    void submit(() =>
      savePersonalInfo(getSupabaseClient(), user.id, {
        preferred_name: values.preferredName || null,
        first_name: values.firstName || null,
        middle_initial: values.middleInitial || null,
        last_name: values.lastName || null,
        legal_name: legalName || null,
        base_city: values.baseCity || null,
        alternate_email: values.alternateEmail || null,
        phone_number: values.phoneNumber || null,
        whatsapp: values.whatsapp || null,
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
        <div className="grid gap-4 sm:grid-cols-[1fr_5rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor="personal-first">{t('registration.personalInfo.firstName')}</Label>
            <Input
              id="personal-first"
              required
              value={values.firstName}
              onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal-middle">
              {t('registration.personalInfo.middleInitial')}
            </Label>
            <Input
              id="personal-middle"
              maxLength={3}
              value={values.middleInitial}
              onChange={(e) => setValues((v) => ({ ...v, middleInitial: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal-last">{t('registration.personalInfo.lastName')}</Label>
            <Input
              id="personal-last"
              required
              value={values.lastName}
              onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('registration.personalInfo.legalNameHint')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="personal-altemail">{t('registration.personalInfo.alternateEmail')}</Label>
          <Input
            id="personal-altemail"
            type="email"
            value={values.alternateEmail}
            onChange={(e) => setValues((v) => ({ ...v, alternateEmail: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personal-phone">{t('registration.personalInfo.phoneNumber')}</Label>
          <Input
            id="personal-phone"
            type="tel"
            inputMode="tel"
            placeholder="+1 415 555 0101"
            value={values.phoneNumber}
            onChange={(e) => setValues((v) => ({ ...v, phoneNumber: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personal-whatsapp">{t('registration.personalInfo.whatsapp')}</Label>
          <Input
            id="personal-whatsapp"
            type="tel"
            inputMode="tel"
            value={values.whatsapp}
            onChange={(e) => setValues((v) => ({ ...v, whatsapp: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="personal-city">{t('registration.personalInfo.baseCity')}</Label>
        <Input
          id="personal-city"
          required
          value={values.baseCity}
          onChange={(e) => setValues((v) => ({ ...v, baseCity: e.target.value }))}
        />
      </div>

      <HibobReadOnlyFields row={row} />
    </SectionChrome>
  );
}

/**
 * Read-only block for HiBob-sourced fields. These are intentionally
 * not editable in Kizuna — every sign-in re-hydrates them from HiBob,
 * so any user edit would be silently overwritten on the next sync.
 * If a value is wrong, it gets fixed in HiBob, not here.
 *
 * Renders nothing when the row has no HiBob data — first-time users
 * pre-sync see an empty section, not four blank dashes.
 */
function HibobReadOnlyFields({
  row,
}: {
  row: { job_title?: string | null; team?: string | null; start_date?: string | null; pronouns?: string | null; hibob_synced_at?: string | null } | null | undefined;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  if (!row) return null;
  const hasAny = Boolean(row.job_title || row.team || row.start_date || row.pronouns);
  if (!hasAny) return null;

  const startDateLabel = row.start_date
    ? new Date(row.start_date).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold">{t('registration.personalInfo.fromHibob')}</h3>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <ReadOnlyRow label={t('registration.personalInfo.title')} value={row.job_title} />
        <ReadOnlyRow label={t('registration.personalInfo.team')} value={row.team} />
        <ReadOnlyRow label={t('registration.personalInfo.startDate')} value={startDateLabel} />
        <ReadOnlyRow label={t('registration.personalInfo.pronouns')} value={row.pronouns} />
      </dl>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
