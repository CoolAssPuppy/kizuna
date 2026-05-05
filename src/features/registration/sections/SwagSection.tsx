import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { useHydratedFormState } from '@/hooks/useHydratedFormState';
import { useStorageImage } from '@/lib/useStorageImage';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import {
  loadMySwagSelections,
  loadVisibleSwagItems,
  saveSwagSelections,
  type SwagItemRow,
  type SwagSelectionInput,
  type SwagSelectionRow,
} from '../api/swag';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

interface ItemFormState {
  size: string | null;
  optedOut: boolean;
}

type FormState = Record<string, ItemFormState>;

const EMPTY_FORM: FormState = {};

interface QueryBundle {
  items: ReadonlyArray<SwagItemRow>;
  ownSelections: ReadonlyArray<SwagSelectionRow>;
}

function buildFormState({ items, ownSelections }: QueryBundle): FormState {
  const byItemId = new Map(ownSelections.map((s) => [s.swag_item_id, s]));
  const out: FormState = {};
  for (const item of items) {
    const sel = byItemId.get(item.id);
    out[item.id] = { size: sel?.size ?? null, optedOut: sel?.opted_out ?? false };
  }
  return out;
}

export function SwagSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;

  const itemsQuery = useQuery({
    queryKey: ['swag-items', eventId],
    enabled: eventId !== null,
    queryFn: () => loadVisibleSwagItems(getSupabaseClient(), eventId!),
  });

  const selectionsQuery = useQuery({
    queryKey: ['swag-selections', user?.id ?? null, eventId],
    enabled: !!user && eventId !== null,
    queryFn: () => loadMySwagSelections(getSupabaseClient(), user!.id),
  });

  const items = itemsQuery.data ?? [];
  const ownSelections = selectionsQuery.data?.own ?? [];
  const hydrated = itemsQuery.isSuccess && selectionsQuery.isSuccess;
  const [form, setForm] = useHydratedFormState<QueryBundle, FormState>(
    hydrated,
    { items, ownSelections },
    EMPTY_FORM,
    buildFormState,
  );

  const isLocked = event?.swag_locked_at != null;

  function setItem(itemId: string, next: Partial<ItemFormState>): void {
    setForm((prev) => ({
      ...prev,
      [itemId]: {
        size: prev[itemId]?.size ?? null,
        optedOut: prev[itemId]?.optedOut ?? false,
        ...next,
      },
    }));
  }

  // Save is enabled when every visible item has either a size picked or
  // the opt-out box checked. Items with allows_opt_out=false require a
  // size — opt-out is hidden in that case so the user can't satisfy the
  // gate without choosing.
  const allAnswered = items.every((item) => {
    const state = form[item.id];
    if (item.allows_opt_out) return state?.optedOut === true || Boolean(state?.size);
    return Boolean(state?.size);
  });

  // The swag task auto-ticks via maybe_complete_swag_task inside the
  // RPC, so we pass taskKey: null and let useSectionSubmit handle the
  // toast + wizard advance. Profile-mode mark_my_registration_task_complete
  // would conflict with the gate's "every item answered" semantic.
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: null,
    toastSuccessKey: 'profile.toast.swagSaved',
    invalidateQueryKeys: [['swag-selections'], ['registration']],
  });

  function handleSubmit(): void {
    if (!eventId || isLocked) return;
    void submit(async () => {
      const payload: SwagSelectionInput[] = items.map((item) => {
        const state = form[item.id] ?? { size: null, optedOut: false };
        return {
          swagItemId: item.id,
          size: state.optedOut ? null : state.size,
          optedOut: state.optedOut,
        };
      });
      await saveSwagSelections(getSupabaseClient(), eventId, payload);
    });
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.swag')}
      description={t('registration.swag.intro')}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
      submitDisabled={!allAnswered || isLocked}
    >
      {isLocked ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"
        >
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium">{t('registration.swag.lockedTitle')}</p>
            <p>{t('registration.swag.lockedBody')}</p>
          </div>
        </div>
      ) : null}

      {hydrated && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('registration.swag.empty')}</p>
      ) : null}

      <div className="space-y-8">
        {items.map((item) => (
          <SwagItemCard
            key={item.id}
            item={item}
            state={form[item.id]}
            onSizeChange={(size) => setItem(item.id, { size, optedOut: false })}
            onOptOutChange={(optedOut) =>
              setItem(item.id, { optedOut, size: optedOut ? null : (form[item.id]?.size ?? null) })
            }
            disabled={isLocked}
          />
        ))}
      </div>
    </SectionChrome>
  );
}

interface SwagItemCardProps {
  item: SwagItemRow;
  state: ItemFormState | undefined;
  onSizeChange: (size: string) => void;
  onOptOutChange: (optedOut: boolean) => void;
  disabled: boolean;
}

function SwagItemCard({
  item,
  state,
  onSizeChange,
  onOptOutChange,
  disabled,
}: SwagItemCardProps): JSX.Element {
  const { t } = useTranslation();
  const cover = useStorageImage('event-content', item.image_path ?? '');
  const sizing = useStorageImage('event-content', item.size_image_path ?? '');
  return (
    <article className="rounded-md border bg-card p-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-40 w-full shrink-0 rounded-md object-cover sm:w-48"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{item.name}</h3>
            {item.description ? (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t('registration.swag.pickSize')}</Label>
            <div className="flex flex-wrap gap-2">
              {item.sizes.map((size) => {
                const selected = state?.size === size && !state?.optedOut;
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={disabled || state?.optedOut}
                    onClick={() => onSizeChange(size)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {sizing ? (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                {t('registration.swag.sizingChart')}
              </summary>
              <img
                src={sizing}
                alt={t('registration.swag.sizingChartAlt')}
                loading="lazy"
                className="mt-2 max-h-96 rounded-md border"
              />
            </details>
          ) : null}

          {item.allows_opt_out ? (
            <label htmlFor={`swag-opt-out-${item.id}`} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`swag-opt-out-${item.id}`}
                checked={state?.optedOut ?? false}
                disabled={disabled}
                onCheckedChange={(checked) => onOptOutChange(checked === true)}
              />
              {t('registration.swag.optOut')}
            </label>
          ) : null}
        </div>
      </div>
    </article>
  );
}
