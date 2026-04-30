import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { loadChildren, saveChildren } from './api';
import { StepShell } from './StepShell';
import type { RegistrationBundle } from './types';

const SPECIAL_NEEDS_OPTIONS = ['crib', 'high_chair', 'allergy', 'mobility', 'other'] as const;

interface Props {
  /** Reserved for future task-marking when 'children' enters registration_task_key. */
  bundle?: RegistrationBundle;
  onComplete: () => void;
}

interface ChildEntry {
  id?: string;
  fullName: string;
  dateOfBirth: string;
  specialNeeds: string[];
  notes: string;
}

const EMPTY_CHILD: ChildEntry = { fullName: '', dateOfBirth: '', specialNeeds: [], notes: '' };

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ChildrenStep({ bundle: _bundle, onComplete }: Props): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const rows = await loadChildren(getSupabaseClient(), user.id);
      if (!active) return;
      setChildren(
        rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          dateOfBirth: row.date_of_birth,
          specialNeeds: row.special_needs,
          notes: row.notes ?? '',
        })),
      );
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function update(index: number, patch: Partial<ChildEntry>): void {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSubmit(): Promise<void> {
    if (!user) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await saveChildren(
        getSupabaseClient(),
        user.id,
        children.map((c) => ({
          ...(c.id ? { id: c.id } : {}),
          full_name: c.fullName,
          date_of_birth: c.dateOfBirth,
          special_needs: c.specialNeeds,
          notes: c.notes.trim() || null,
        })),
      );
      // Children step uses the dietary task slot in registration_tasks for
      // Phase 1 — there's no dedicated children task_key in the enum yet.
      // Skip task marking until we add 'children' to registration_task_key.
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title={t('registration.steps.children')}
      subtitle={t('registration.children.intro')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={!hydrated}
    >
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('registration.children.noChildren')}</p>
      ) : null}

      {children.map((child, index) => (
        <fieldset key={index} className="space-y-3 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor={`child-name-${index}`}>{t('registration.children.fullName')}</Label>
            <Input
              id={`child-name-${index}`}
              required
              value={child.fullName}
              onChange={(e) => update(index, { fullName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`child-dob-${index}`}>{t('registration.children.dateOfBirth')}</Label>
            <Input
              id={`child-dob-${index}`}
              type="date"
              required
              value={child.dateOfBirth}
              onChange={(e) => update(index, { dateOfBirth: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('registration.children.specialNeeds')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIAL_NEEDS_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={child.specialNeeds.includes(option)}
                    onChange={() =>
                      update(index, { specialNeeds: toggle(child.specialNeeds, option) })
                    }
                  />
                  {t(`registration.children.specialNeedsOptions.${option}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`child-notes-${index}`}>{t('registration.children.notes')}</Label>
            <Textarea
              id={`child-notes-${index}`}
              value={child.notes}
              onChange={(e) => update(index, { notes: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setChildren((prev) => prev.filter((_, i) => i !== index))}
          >
            {t('registration.children.removeChild')}
          </Button>
        </fieldset>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => setChildren((prev) => [...prev, { ...EMPTY_CHILD }])}
      >
        {t('registration.children.addChild')}
      </Button>
    </StepShell>
  );
}
