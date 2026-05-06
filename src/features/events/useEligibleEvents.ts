import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import type { EventRow } from './useActiveEvent';

/**
 * Returns every event the calling user is eligible for, ordered most
 * recent first. Eligibility is computed server-side by the
 * `list_my_eligible_events` RPC, which walks the same five truth paths
 * that RLS does. The hook is keyed on the user id so a sign-out / sign-in
 * resets the cache cleanly.
 */
export function useEligibleEvents(): {
  data: EventRow[];
  isLoading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();
  const query = useQuery<EventRow[]>({
    queryKey: ['eligible-events', user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('list_my_eligible_events');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
