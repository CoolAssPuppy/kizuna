import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { SectionChrome } from './SectionChrome';
import type { SectionProps } from './types';
import { useSectionSubmit } from './useSectionSubmit';

type GroundTransportNeed = Database['public']['Enums']['ground_transport_need'];

const NEED_OPTIONS: ReadonlyArray<{ value: GroundTransportNeed; labelKey: string }> = [
  { value: 'both', labelKey: 'registration.transport.options.both' },
  { value: 'arrival', labelKey: 'registration.transport.options.arrival' },
  { value: 'departure', labelKey: 'registration.transport.options.departure' },
  { value: 'none', labelKey: 'registration.transport.options.none' },
];

/**
 * Asks the attendee which airport-transfer leg(s) they want admin-arranged.
 * The choice persists to attendee_profiles.ground_transport_need; the
 * Ground Transport Tool reads from there to know who needs a vehicle on
 * arrival vs departure (vs neither vs both).
 */
export function TransportSection({ mode }: SectionProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isSuccess: hydrated } = useQuery({
    queryKey: ['attendee_profile', 'ground_transport_need', user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('attendee_profiles')
        .select('ground_transport_need')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.ground_transport_need ?? ('none' satisfies GroundTransportNeed);
    },
  });
  const [need, setNeed] = useState<GroundTransportNeed | null>(null);
  // Sync local state from the fetched value once. Subsequent edits
  // are owned by the radio's onChange.
  if (need === null && hydrated && data !== undefined) {
    setNeed(data);
  }
  const { busy, errorKey, submit } = useSectionSubmit({
    mode,
    taskKey: 'transport',
    toastSuccessKey: 'profile.toast.transportSaved',
  });

  function handleSubmit(): void {
    if (!user || need === null) return;
    void submit(async () => {
      const { error } = await getSupabaseClient()
        .from('attendee_profiles')
        .upsert({ user_id: user.id, ground_transport_need: need }, { onConflict: 'user_id' });
      if (error) throw error;
    });
  }

  return (
    <SectionChrome
      mode={mode}
      title={t('registration.steps.transport')}
      description={t('registration.transport.intro')}
      busy={busy}
      hydrated={hydrated}
      errorKey={errorKey}
      onSubmit={handleSubmit}
      submitDisabled={need === null}
    >
      <div className="space-y-2">
        {NEED_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="transport"
              className="h-4 w-4 accent-primary"
              checked={need === opt.value}
              onChange={() => setNeed(opt.value)}
            />
            {t(opt.labelKey)}
          </label>
        ))}
      </div>
    </SectionChrome>
  );
}
