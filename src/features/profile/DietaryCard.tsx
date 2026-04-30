import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { loadDietary, saveDietary } from '@/features/registration/api';
import type { DietaryRow } from '@/features/registration/types';
import { getSupabaseClient } from '@/lib/supabase';

const RESTRICTION_OPTIONS = [
  'vegan',
  'vegetarian',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
] as const;

interface FormState {
  restrictions: string[];
  severity: DietaryRow['severity'];
  notes: string;
  alcoholFree: boolean;
}

const EMPTY: FormState = {
  restrictions: [],
  severity: 'preference',
  notes: '',
  alcoholFree: false,
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function DietaryCard(): JSX.Element {
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
      const row = await loadDietary(getSupabaseClient(), user.id);
      if (!active) return;
      setValues({
        restrictions: row?.restrictions ?? [],
        severity: row?.severity ?? 'preference',
        notes: row?.notes ?? '',
        alcoholFree: row?.alcohol_free ?? false,
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
      await saveDietary(getSupabaseClient(), user.id, {
        restrictions: values.restrictions,
        allergies: [],
        alcohol_free: values.alcoholFree,
        severity: values.severity,
        notes: values.notes.trim() || null,
      });
      show(t('profile.toast.dietarySaved'));
    } catch {
      show(t('profile.toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell title={t('registration.steps.dietary')} description={t('profile.cards.dietary')}>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('registration.dietary.restrictions')}</legend>
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
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={values.alcoholFree}
            onCheckedChange={(value) => setValues((v) => ({ ...v, alcoholFree: value === true }))}
          />
          {t('registration.dietary.alcoholFree')}
        </label>
        <div className="space-y-2">
          <Label htmlFor="profile-diet-notes">{t('registration.dietary.notes')}</Label>
          <Textarea
            id="profile-diet-notes"
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
        </div>
        <Button onClick={() => void handleSave()} disabled={busy || !hydrated}>
          {busy ? t('registration.saving') : t('actions.save')}
        </Button>
      </div>
    </CardShell>
  );
}
