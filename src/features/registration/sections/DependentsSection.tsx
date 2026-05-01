import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { Checkbox } from '@/components/ui/checkbox';

import { loadAdditionalGuests, saveAdditionalGuests } from '../api';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';
import { toggleArrayMember } from './utils';

const SPECIAL_NEEDS_OPTIONS = ['crib', 'high_chair', 'allergy', 'mobility', 'other'] as const;

interface MinorEntry {
  id: string;
  fullName: string;
  ageBracketLabel: string;
  specialNeeds: string[];
  notes: string;
}

/**
 * Minor profile editor. Minors are CREATED through the Invite-a-Guest
 * dialog (which captures the age bracket and locks in the fee). This
 * section lets the sponsor and the sponsor's adult guests edit each
 * minor's name, special needs, and notes after the fact. The age
 * bracket is intentionally read-only: changing it would shift the fee
 * and break Stripe reconciliation.
 */
export function DependentsSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [minors, setMinors] = useState<MinorEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: null,
    toastSuccessKey: 'profile.toast.dependentsSaved',
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const rows = await loadAdditionalGuests(getSupabaseClient(), user.id);
      if (!active) return;
      setMinors(
        rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          ageBracketLabel: t(`registration.guests.brackets.${row.age_bracket}`),
          specialNeeds: row.special_needs,
          notes: row.notes ?? '',
        })),
      );
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user, t]);

  function update(index: number, patch: Partial<MinorEntry>): void {
    setMinors((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function handleSubmit(): void {
    if (!user) return;
    void submit(() =>
      saveAdditionalGuests(
        getSupabaseClient(),
        user.id,
        minors.map((m) => ({
          id: m.id,
          full_name: m.fullName,
          special_needs: m.specialNeeds,
          notes: m.notes.trim() || null,
        })),
      ),
    );
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.dependents')}
      description={t('registration.dependents.intro')}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
    >
      {minors.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          {t('registration.dependents.noMinorsYet')}
        </p>
      ) : null}

      {minors.map((minor, index) => (
        <fieldset key={minor.id} className="space-y-3 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor={`minor-name-${index}`}>{t('registration.dependents.fullName')}</Label>
            <Input
              id={`minor-name-${index}`}
              required
              value={minor.fullName}
              onChange={(e) => update(index, { fullName: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('registration.dependents.ageBracketLabel', { bracket: minor.ageBracketLabel })}
          </p>
          <div className="space-y-2">
            <Label>{t('registration.dependents.specialNeeds')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIAL_NEEDS_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={minor.specialNeeds.includes(option)}
                    onCheckedChange={() =>
                      update(index, {
                        specialNeeds: toggleArrayMember(minor.specialNeeds, option),
                      })
                    }
                  />
                  {t(`registration.dependents.specialNeedsOptions.${option}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`minor-notes-${index}`}>{t('registration.dependents.notes')}</Label>
            <Textarea
              id={`minor-notes-${index}`}
              value={minor.notes}
              onChange={(e) => update(index, { notes: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMinors((prev) => prev.filter((_, i) => i !== index))}
          >
            {t('registration.dependents.removeGuest')}
          </Button>
        </fieldset>
      ))}
    </SectionChrome>
  );
}
