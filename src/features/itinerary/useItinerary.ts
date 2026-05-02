import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { fetchItinerary } from './api';
import type { ItineraryItemRow } from './types';

const itineraryKey = (eventId: string, userId: string): readonly unknown[] =>
  ['itinerary', eventId, userId] as const;

interface Args {
  eventId: string;
}

/**
 * Loads itinerary items for the current user / event and subscribes to
 * Realtime for live updates. When a flight is rebooked or a session is
 * moved, the trigger-maintained itinerary_items row fires here without
 * a manual refetch.
 */
export function useItinerary({ eventId }: Args): {
  data: ItineraryItemRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
  invalidate: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  const query = useQuery({
    queryKey: itineraryKey(eventId, userId ?? 'anon'),
    enabled: userId !== null,
    queryFn: () => {
      if (userId === null) return Promise.resolve([]);
      return fetchItinerary(supabase, { userId, eventId });
    },
  });

  // useEffect (not useMountEffect) because the channel filter scopes
  // by userId + eventId and both can change at runtime.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (userId === null) return;
    const channel = supabase
      .channel(`itinerary:${userId}:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itinerary_items',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: itineraryKey(eventId, userId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, eventId, queryClient]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error ?? null,
    invalidate: () => {
      void queryClient.invalidateQueries({
        queryKey: itineraryKey(eventId, userId ?? 'anon'),
      });
    },
  };
}
