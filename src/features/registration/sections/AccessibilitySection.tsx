import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadAccessibility, saveAccessibility } from '../api';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

const NEEDS_OPTIONS = [
  'mobility',
  'vision',
  'hearing',
  'neurodivergent',
  'chronic_condition',
  'other',
] as const;

interface FormState {
  needs: string[];
  notes: string;
}

const EMPTY: FormState = { needs: [], notes: '' };

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AccessibilitySection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'accessibility',
    toastSuccessKey: 'profile.toast.accessibilitySaved',
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const row = await loadAccessibility(getSupabaseClient(), user.id);
      if (!active) return;
      setValues({
        needs: row?.needs ?? [],
        notes: row?.notes ?? '',
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
      saveAccessibility(getSupabaseClient(), user.id, {
        needs: values.needs,
        notes: values.notes.trim() || null,
      }),
    );
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.accessibility')}
      description={t('registration.accessibility.intro')}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('registration.accessibility.needs')}</legend>
        <p className="text-xs text-muted-foreground">
          {t('registration.accessibility.needsHint')}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {NEEDS_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.needs.includes(option)}
                onCheckedChange={() =>
                  setValues((v) => ({ ...v, needs: toggle(v.needs, option) }))
                }
              />
              {t(`registration.accessibility.needsOptions.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="accessibility-notes">{t('registration.accessibility.notes')}</Label>
        <Textarea
          id="accessibility-notes"
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">{t('registration.accessibility.notesHint')}</p>
      </div>
    </SectionChrome>
  );
}
