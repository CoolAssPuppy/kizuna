import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadDietary, markTaskComplete, saveDietary } from './api';
import { StepShell } from './StepShell';
import type { DietaryRow, RegistrationBundle } from './types';

const RESTRICTION_OPTIONS = [
  'vegan',
  'vegetarian',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
] as const;

const ALLERGY_OPTIONS = ['nuts', 'shellfish', 'dairy', 'eggs', 'soy', 'wheat', 'sesame'] as const;

const SEVERITY_OPTIONS: ReadonlyArray<DietaryRow['severity']> = [
  'preference',
  'intolerance',
  'allergy',
];

interface DietaryStepProps {
  bundle: RegistrationBundle;
  onComplete: () => void;
}

interface FormState {
  restrictions: string[];
  allergies: string[];
  alcoholFree: boolean;
  severity: DietaryRow['severity'];
  notes: string;
}

const EMPTY: FormState = {
  restrictions: [],
  allergies: [],
  alcoholFree: false,
  severity: 'preference',
  notes: '',
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function DietaryStep({ bundle, onComplete }: DietaryStepProps): JSX.Element {
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
      const row = await loadDietary(getSupabaseClient(), user.id);
      if (!active) return;
      setValues(
        row
          ? {
              restrictions: row.restrictions,
              allergies: row.allergies,
              alcoholFree: row.alcohol_free,
              severity: row.severity,
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
      await saveDietary(getSupabaseClient(), user.id, {
        restrictions: values.restrictions,
        allergies: values.allergies,
        alcohol_free: values.alcoholFree,
        severity: values.severity,
        notes: values.notes.trim() || null,
      });
      await markTaskComplete(getSupabaseClient(), bundle.registration.id, 'dietary');
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title={t('registration.steps.dietary')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={!hydrated}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('registration.dietary.restrictions')}</legend>
        <p className="text-xs text-muted-foreground">
          {t('registration.dietary.restrictionsHint')}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {RESTRICTION_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.restrictions.includes(option)}
                onCheckedChange={() =>
                  setValues((v) => ({ ...v, restrictions: toggle(v.restrictions, option) }))
                }
              />
              {option.replace('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('registration.dietary.allergies')}</legend>
        <p className="text-xs text-muted-foreground">{t('registration.dietary.allergiesHint')}</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {ALLERGY_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.allergies.includes(option)}
                onCheckedChange={() =>
                  setValues((v) => ({ ...v, allergies: toggle(v.allergies, option) }))
                }
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('registration.dietary.severity')}</Label>
        <p className="text-xs text-muted-foreground">{t('registration.dietary.severityHint')}</p>
        <div className="flex flex-col gap-2 pt-1">
          {SEVERITY_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="severity"
                checked={values.severity === option}
                onChange={() => setValues((v) => ({ ...v, severity: option }))}
                className="h-4 w-4 accent-primary"
              />
              {t(`registration.dietary.severityOptions.${option}`)}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={values.alcoholFree}
          onCheckedChange={(value) => setValues((v) => ({ ...v, alcoholFree: value === true }))}
        />
        {t('registration.dietary.alcoholFree')}
      </label>

      <div className="space-y-2">
        <Label htmlFor="dietary-notes">{t('registration.dietary.notes')}</Label>
        <Textarea
          id="dietary-notes"
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </div>
    </StepShell>
  );
}
