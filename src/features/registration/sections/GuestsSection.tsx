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

interface GuestEntry {
  id?: string;
  fullName: string;
  age: string;
  specialNeeds: string[];
  notes: string;
}

const EMPTY_GUEST: GuestEntry = { fullName: '', age: '', specialNeeds: [], notes: '' };

export function GuestsSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // 'guest' in registration_task_key refers to the M5 invitation flow,
  // not these dependents. No task to mark complete here.
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: null,
    toastSuccessKey: 'profile.toast.guestsSaved',
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const rows = await loadAdditionalGuests(getSupabaseClient(), user.id);
      if (!active) return;
      setGuests(
        rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          age: String(row.age),
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

  function update(index: number, patch: Partial<GuestEntry>): void {
    setGuests((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function handleSubmit(): void {
    if (!user) return;
    void submit(() =>
      saveAdditionalGuests(
        getSupabaseClient(),
        user.id,
        guests.map((g) => ({
          ...(g.id ? { id: g.id } : {}),
          full_name: g.fullName,
          age: Number.parseInt(g.age, 10) || 0,
          special_needs: g.specialNeeds,
          notes: g.notes.trim() || null,
        })),
      ),
    );
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.guests')}
      description={t('registration.guests.intro')}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
    >
      {guests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('registration.guests.noGuests')}</p>
      ) : null}

      {guests.map((guest, index) => (
        <fieldset key={guest.id ?? `new-${index}`} className="space-y-3 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor={`guest-name-${index}`}>{t('registration.guests.fullName')}</Label>
            <Input
              id={`guest-name-${index}`}
              required
              value={guest.fullName}
              onChange={(e) => update(index, { fullName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`guest-age-${index}`}>{t('registration.guests.age')}</Label>
            <Input
              id={`guest-age-${index}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={119}
              required
              value={guest.age}
              onChange={(e) => update(index, { age: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t('registration.guests.ageHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('registration.guests.specialNeeds')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIAL_NEEDS_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={guest.specialNeeds.includes(option)}
                    onCheckedChange={() =>
                      update(index, {
                        specialNeeds: toggleArrayMember(guest.specialNeeds, option),
                      })
                    }
                  />
                  {t(`registration.guests.specialNeedsOptions.${option}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`guest-notes-${index}`}>{t('registration.guests.notes')}</Label>
            <Textarea
              id={`guest-notes-${index}`}
              value={guest.notes}
              onChange={(e) => update(index, { notes: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setGuests((prev) => prev.filter((_, i) => i !== index))}
          >
            {t('registration.guests.removeGuest')}
          </Button>
        </fieldset>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => setGuests((prev) => [...prev, { ...EMPTY_GUEST }])}
      >
        {t('registration.guests.addGuest')}
      </Button>
    </SectionChrome>
  );
}
