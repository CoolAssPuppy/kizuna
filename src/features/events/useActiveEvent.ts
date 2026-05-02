import { useQuery } from '@tanstack/react-query';

import { SELECT_EVENTS_BASE } from '@/lib/supabase/columns';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { useEventOverride } from './eventOverride';

export type EventRow = Database['public']['Tables']['events']['Row'];

/**
 * Returns the event the app is currently rendering. Default: the single
 * Supafest event flagged is_active = true. Admins can pick a different
 * event from the All events screen, which sets a per-browser override
 * (see eventOverride.ts) — this hook prefers that override when set.
 */
export function useActiveEvent(): {
  data: EventRow | null;
  isLoading: boolean;
  error: Error | null;
} {
  const override = useEventOverride();
  const query = useQuery({
    queryKey: ['active-event', override],
    queryFn: async (): Promise<EventRow | null> => {
      if (override) {
        const { data, error } = await getSupabaseClient()
          .from('events')
          .select(SELECT_EVENTS_BASE)
          .eq('id', override)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }
      const { data, error } = await getSupabaseClient()
        .from('events')
        .select(SELECT_EVENTS_BASE)
        .eq('is_active', true)
        .eq('type', 'supafest')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
