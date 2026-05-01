import { useQuery } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type EditorialFeedItem = Database['public']['Tables']['feed_items']['Row'];

interface Result {
  main: EditorialFeedItem[];
  sidebar: EditorialFeedItem[];
  isLoading: boolean;
}

export function useEditorialFeed(eventId: string | null): Result {
  const query = useQuery({
    queryKey: ['home', 'editorial-feed', eventId],
    enabled: eventId !== null,
    queryFn: async () => {
      if (!eventId) return [];
      // RLS already filters out items outside their display window for
      // non-admin readers; admins see everything but the `position`
      // ordering matches the rendered order either way.
      const { data, error } = await getSupabaseClient()
        .from('feed_items')
        .select('*')
        .eq('event_id', eventId)
        .order('location', { ascending: true })
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const items = query.data ?? [];
  return {
    main: items.filter((i) => i.location === 'main'),
    sidebar: items.filter((i) => i.location === 'sidebar'),
    isLoading: query.isLoading,
  };
}
