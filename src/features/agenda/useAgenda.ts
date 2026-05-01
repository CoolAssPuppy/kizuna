import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { type AgendaSession, favoriteSession, fetchAgenda, unfavoriteSession } from './api';

const queryKey = (eventId: string, userId: string): readonly unknown[] =>
  ['agenda', eventId, userId] as const;

export function useAgenda(eventId: string): {
  data: AgendaSession[] | undefined;
  isLoading: boolean;
  error: Error | null;
  toggleFavorite: (session: AgendaSession) => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(eventId, userId ?? 'anon'),
    enabled: userId !== null,
    queryFn: () => {
      if (!userId) return Promise.resolve([] as AgendaSession[]);
      return fetchAgenda(getSupabaseClient(), { eventId, userId });
    },
  });

  const mutation = useMutation({
    mutationFn: async (session: AgendaSession) => {
      if (!userId) return;
      const client = getSupabaseClient();
      if (session.is_favorite) {
        await unfavoriteSession(client, { sessionId: session.id, userId });
      } else {
        await favoriteSession(client, { sessionId: session.id, userId });
      }
    },
    onMutate: async (session) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: queryKey(eventId, userId) });
      const previous = queryClient.getQueryData<AgendaSession[]>(queryKey(eventId, userId));
      if (previous) {
        queryClient.setQueryData<AgendaSession[]>(
          queryKey(eventId, userId),
          previous.map((s) => (s.id === session.id ? { ...s, is_favorite: !s.is_favorite } : s)),
        );
      }
      return { previous };
    },
    onError: (_err, _session, ctx) => {
      if (!userId || !ctx?.previous) return;
      queryClient.setQueryData(queryKey(eventId, userId), ctx.previous);
    },
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKey(eventId, userId) });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error ?? null,
    toggleFavorite: (session) => mutation.mutate(session),
  };
}
