import { useQuery } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';

export interface EventStats {
  employeeCount: number;
  guestCount: number;
  registrationsStarted: number;
  registrationsComplete: number;
  documentsAcknowledged: number;
}

/**
 * Aggregated counts for the home-page facts column.
 *
 * Each query is a head + count read, so they're cheap and RLS-safe
 * (every authenticated user can read the totals; row payloads stay
 * scoped by RLS as usual).
 */
export function useEventStats(eventId: string | null): {
  data: EventStats | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['home', 'event-stats', eventId],
    enabled: eventId !== null,
    queryFn: () => loadStats(eventId!),
    staleTime: 60_000,
  });
  return { data: query.data, isLoading: query.isLoading };
}

async function loadStats(eventId: string): Promise<EventStats> {
  const supabase = getSupabaseClient();
  const [employeeCount, guestCount, started, complete, acknowledgements] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }).neq('role', 'guest'),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'guest'),
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'started'),
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'complete'),
    supabase
      .from('document_acknowledgements')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
  ]);

  return {
    employeeCount: employeeCount.count ?? 0,
    guestCount: guestCount.count ?? 0,
    registrationsStarted: started.count ?? 0,
    registrationsComplete: complete.count ?? 0,
    documentsAcknowledged: acknowledgements.count ?? 0,
  };
}
