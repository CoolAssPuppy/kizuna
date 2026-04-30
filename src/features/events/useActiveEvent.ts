import { useQuery } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type EventRow = Database['public']['Tables']['events']['Row'];

/**
 * Returns the single active Supafest event. Phase 1 ships against one event
 * at a time; this hook is the canonical accessor for "the event the user is
 * registering for". Event picker UI is post-Supafest 2027 (Phase 4).
 */
export function useActiveEvent(): {
  data: EventRow | null;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: ['active-event'],
    queryFn: async (): Promise<EventRow | null> => {
      const { data, error } = await getSupabaseClient()
        .from('events')
        .select('*')
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
