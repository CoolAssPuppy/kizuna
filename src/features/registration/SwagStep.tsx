import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import {
  loadSwagCatalogue,
  loadSwagSelections,
  markTaskComplete,
  saveSwagSelections,
  type SwagSelectionInput,
} from './api';
import { StepShell } from './StepShell';
import type { RegistrationBundle } from './types';
import type { Database } from '@/types/database.types';

type SwagItemRow = Database['public']['Tables']['swag_items']['Row'];

interface Props {
  bundle: RegistrationBundle;
  onComplete: () => void;
}

interface SelectionState {
  optedIn: boolean;
  size: string;
  fitPreference: 'fitted' | 'relaxed' | '';
}

const EMPTY_SELECTION: SelectionState = { optedIn: true, size: '', fitPreference: '' };

export function SwagStep({ bundle, onComplete }: Props): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const [catalogue, setCatalogue] = useState<SwagItemRow[]>([]);
  const [selections, setSelections] = useState<Record<string, SelectionState>>({});
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !event) return;
    let active = true;
    void (async () => {
      const [items, picks] = await Promise.all([
        loadSwagCatalogue(getSupabaseClient(), event.id),
        loadSwagSelections(getSupabaseClient(), user.id),
      ]);
      if (!active) return;
      setCatalogue(items);
      const map: Record<string, SelectionState> = {};
      for (const item of items) {
        const existing = picks.find((p) => p.swag_item_id === item.id);
        map[item.id] = existing
          ? {
              optedIn: existing.opted_in,
              size: existing.size ?? '',
              fitPreference: (existing.fit_preference as 'fitted' | 'relaxed' | null) ?? '',
            }
          : { ...EMPTY_SELECTION };
      }
      setSelections(map);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user, event]);

  async function handleSubmit(): Promise<void> {
    if (!user) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const payload: SwagSelectionInput[] = catalogue.map((item) => {
        const sel = selections[item.id] ?? EMPTY_SELECTION;
        return {
          swagItemId: item.id,
          optedIn: sel.optedIn,
          size: item.requires_sizing && sel.optedIn ? sel.size || null : null,
          fitPreference:
            item.has_fit_options && sel.optedIn
              ? sel.fitPreference === ''
                ? null
                : sel.fitPreference
              : null,
        };
      });
      await saveSwagSelections(getSupabaseClient(), user.id, payload);
      await markTaskComplete(getSupabaseClient(), bundle.registration.id, 'swag');
      onComplete();
    } catch {
      setErrorKey('registration.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  function update(itemId: string, patch: Partial<SelectionState>): void {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? EMPTY_SELECTION), ...patch },
    }));
  }

  return (
    <StepShell
      title={t('registration.steps.swag')}
      onSubmit={() => void handleSubmit()}
      busy={busy}
      errorKey={errorKey}
      submitDisabled={!hydrated}
    >
      {catalogue.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('registration.swag.noCatalogue')}</p>
      ) : null}

      {catalogue.map((item) => {
        const sel = selections[item.id] ?? EMPTY_SELECTION;
        return (
          <fieldset key={item.id} className="space-y-3 rounded-md border p-4">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                {item.description ? (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sel.optedIn}
                  onCheckedChange={(value) => update(item.id, { optedIn: value === true })}
                />
                {t('registration.swag.optIn')}
              </label>
            </header>

            {sel.optedIn && item.requires_sizing ? (
              <div className="space-y-2">
                <Label>{t('registration.swag.size')}</Label>
                <div className="flex flex-wrap gap-2">
                  {item.available_sizes.map((size) => (
                    <label key={size} className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        name={`size-${item.id}`}
                        className="h-4 w-4 accent-primary"
                        checked={sel.size === size}
                        onChange={() => update(item.id, { size })}
                      />
                      {size}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {sel.optedIn && item.has_fit_options ? (
              <div className="space-y-2">
                <Label>{t('registration.swag.fitPreference')}</Label>
                <div className="flex gap-3">
                  {(['fitted', 'relaxed'] as const).map((fit) => (
                    <label key={fit} className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        name={`fit-${item.id}`}
                        className="h-4 w-4 accent-primary"
                        checked={sel.fitPreference === fit}
                        onChange={() => update(item.id, { fitPreference: fit })}
                      />
                      {t(`registration.swag.fitOptions.${fit}`)}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </fieldset>
        );
      })}
    </StepShell>
  );
}
