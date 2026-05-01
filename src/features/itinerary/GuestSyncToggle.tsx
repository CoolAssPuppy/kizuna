import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Link2Off } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { fetchGuestSyncState, setGuestSync } from './api';

/**
 * Guest-only toggle for mirroring the sponsoring employee's itinerary.
 * Renders nothing for non-guest users (no row in guest_profiles).
 *
 * When enabled, fetchItinerary swaps the user_id filter to point at the
 * sponsor; when disabled, the guest sees their own self-imported items.
 */
export function GuestSyncToggle({ onToggle }: { onToggle: () => void }): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { show } = useToast();
  const qc = useQueryClient();

  const { data: sync } = useQuery({
    queryKey: ['guest', 'sync', user?.id],
    queryFn: () => fetchGuestSyncState(getSupabaseClient(), user!.id),
    enabled: !!user,
  });

  const toggle = useMutation({
    mutationFn: (next: boolean) => setGuestSync(getSupabaseClient(), user!.id, next),
    onSuccess: async (_data, next) => {
      await qc.invalidateQueries({ queryKey: ['guest', 'sync', user?.id] });
      show(next ? t('itinerary.guestSync.enabled') : t('itinerary.guestSync.disabled'));
      onToggle();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!sync) return null;

  const enabled = sync.syncs_with_sponsor;
  const Icon = enabled ? Link2 : Link2Off;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
      aria-busy={toggle.isPending}
    >
      <Checkbox
        id="guest-sync-toggle"
        checked={enabled}
        onCheckedChange={(value) => toggle.mutate(value === true)}
        disabled={toggle.isPending}
        aria-label={t('itinerary.guestSync.label')}
      />
      <label htmlFor="guest-sync-toggle" className="flex-1 cursor-pointer space-y-0.5">
        <span className="flex items-center gap-2 font-medium">
          <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
          {t('itinerary.guestSync.label')}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t('itinerary.guestSync.description')}
        </span>
      </label>
    </div>
  );
}
