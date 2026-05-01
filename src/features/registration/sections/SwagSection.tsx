import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

import {
  loadAdditionalGuestSwagSizes,
  loadSelfSwagSize,
  saveAdditionalGuestSwagSize,
  saveSelfSwagSize,
} from '../api/swag';
import { loadAdditionalGuests } from '../api/additionalGuests';
import { EU_SHOE_SIZES, US_SHOE_SIZES, euToUs, type ShoeSizeSystem, toEu } from '../shoeSize';
import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];

const TSHIRT_SIZES: ReadonlyArray<string> = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const KIDS_TSHIRT_SIZES: ReadonlyArray<string> = [
  '2T',
  '3T',
  '4T',
  '5',
  '6',
  '7',
  '8',
  '10',
  '12',
  '14',
];

interface SizingState {
  tshirtSize: string;
  shoeSize: string; // entered value as string (may be float)
  shoeSystem: ShoeSizeSystem;
}

const EMPTY: SizingState = { tshirtSize: '', shoeSize: '', shoeSystem: 'us' };

function fromEu(eu: number | null, system: ShoeSizeSystem): string {
  if (eu === null || eu === undefined) return '';
  if (system === 'eu') return String(eu);
  const us = euToUs(eu);
  return us === null ? '' : String(us);
}

export function SwagSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [self, setSelf] = useState<SizingState>(EMPTY);
  const [guests, setGuests] = useState<AdditionalGuestRow[]>([]);
  const [guestState, setGuestState] = useState<Record<string, SizingState>>({});
  const [hydrated, setHydrated] = useState(false);
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'swag',
    toastSuccessKey: 'profile.toast.swagSaved',
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const client = getSupabaseClient();
      const [own, list, guestSizes] = await Promise.all([
        loadSelfSwagSize(client, user.id),
        loadAdditionalGuests(client, user.id),
        loadAdditionalGuestSwagSizes(client, user.id),
      ]);
      if (!active) return;
      setSelf({
        tshirtSize: own?.tshirt_size ?? '',
        shoeSize: fromEu(own?.shoe_size_eu ?? null, 'us'),
        shoeSystem: 'us',
      });
      setGuests(list);
      const map: Record<string, SizingState> = {};
      for (const guest of list) {
        const sized = guestSizes.find((g) => g.additional_guest_id === guest.id);
        map[guest.id] = {
          tshirtSize: sized?.tshirt_size ?? '',
          shoeSize: fromEu(sized?.shoe_size_eu ?? null, 'us'),
          shoeSystem: 'us',
        };
      }
      setGuestState(map);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function handleSubmit(): void {
    if (!user) return;
    void submit(async () => {
      const client = getSupabaseClient();
      await saveSelfSwagSize(client, user.id, {
        tshirtSize: self.tshirtSize || null,
        shoeSizeEu: parseShoe(self.shoeSize, self.shoeSystem),
      });
      for (const guest of guests) {
        const s = guestState[guest.id] ?? EMPTY;
        await saveAdditionalGuestSwagSize(client, guest.id, {
          tshirtSize: s.tshirtSize || null,
          shoeSizeEu: parseShoe(s.shoeSize, s.shoeSystem),
        });
      }
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
    >
      <SizingFieldset
        title={t('registration.swag.yourSizes')}
        value={self}
        onChange={setSelf}
        tshirtSizes={TSHIRT_SIZES}
      />

      {guests.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">{t('registration.swag.guestsHeading')}</h3>
          {guests.map((guest) => (
            <SizingFieldset
              key={guest.id}
              title={`${guest.full_name} (${t(`registration.guests.brackets.${guest.age_bracket}`)})`}
              value={guestState[guest.id] ?? EMPTY}
              onChange={(next) => setGuestState((prev) => ({ ...prev, [guest.id]: next }))}
              // Under-12 fits the youth t-shirt size grid; teens and
              // adults fit the standard adult grid. Bracket-based switch
              // replaces the previous numeric `age < 14` heuristic.
              tshirtSizes={guest.age_bracket === 'under_12' ? KIDS_TSHIRT_SIZES : TSHIRT_SIZES}
            />
          ))}
        </div>
      ) : null}
    </SectionChrome>
  );
}

interface SizingFieldsetProps {
  title: string;
  value: SizingState;
  onChange: (next: SizingState) => void;
  tshirtSizes: ReadonlyArray<string>;
}

function SizingFieldset({ title, value, onChange, tshirtSizes }: SizingFieldsetProps): JSX.Element {
  const { t } = useTranslation();
  const shoeOptions = value.shoeSystem === 'eu' ? EU_SHOE_SIZES : US_SHOE_SIZES;
  return (
    <fieldset className="space-y-4 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>

      <div className="space-y-2">
        <Label>{t('registration.swag.tshirtSize')}</Label>
        <div className="flex flex-wrap gap-2">
          {tshirtSizes.map((size) => (
            <SizeChip
              key={size}
              label={size}
              selected={value.tshirtSize === size}
              onClick={() => onChange({ ...value, tshirtSize: size })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t('registration.swag.shoeSize')}</Label>
          <div role="tablist" className="flex rounded-md border bg-muted/30 p-0.5">
            {(['us', 'eu'] as const).map((system) => (
              <button
                key={system}
                type="button"
                role="tab"
                aria-selected={value.shoeSystem === system}
                onClick={() => onChange({ ...value, shoeSystem: system, shoeSize: '' })}
                className={cn(
                  'rounded-sm px-2 py-0.5 text-xs font-medium uppercase tracking-wider',
                  value.shoeSystem === system
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {t(`registration.swag.shoeSystem.${system}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {shoeOptions.map((size) => (
            <SizeChip
              key={size}
              label={String(size)}
              selected={value.shoeSize === String(size)}
              onClick={() => onChange({ ...value, shoeSize: String(size) })}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('registration.swag.shoeSizeHint')}</p>
      </div>
    </fieldset>
  );
}

function SizeChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-sm transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-background hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  );
}

function parseShoe(raw: string, system: ShoeSizeSystem): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  return toEu(value, system);
}
