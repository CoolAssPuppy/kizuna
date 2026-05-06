import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { useEventOverride } from './eventOverride';

export type EventRow = Database['public']['Tables']['events']['Row'];

/**
 * Returns the event the app is currently rendering. Resolution order:
 *
 *   1. If a per-browser `eventOverride` is set AND the caller is
 *      eligible for that event → use it. (Admins can also pick events
 *      they're not eligible for from /all-events; the override is
 *      honoured for them too because admins are eligible for everything
 *      via the eligibility helper.)
 *   2. Otherwise → the most recent event the caller is eligible for,
 *      via the `list_my_eligible_events` RPC.
 *   3. If the caller has no eligible events → null. The first-login
 *      router renders /pick-event, which falls back to a "no events
 *      available" page in that case.
 */
export function useActiveEvent(): {
  data: EventRow | null;
  isLoading: boolean;
  error: Error | null;
} {
  const override = useEventOverride();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['active-event', override, user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<EventRow | null> => {
      const client = getSupabaseClient();
      if (override) {
        // Honour the override only if the user can actually see the
        // event (RLS will silently filter otherwise — and falling back
        // to the eligible list keeps the UI consistent rather than
        // leaving the caller stuck on a no-such-event view).
        const { data, error } = await client
          .from('events')
          .select('*')
          .eq('id', override)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }
      const { data, error } = await client.rpc('list_my_eligible_events');
      if (error) throw error;
      const list = (data ?? []) as EventRow[];
      return list[0] ?? null;
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
