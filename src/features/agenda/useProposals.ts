import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { type ProposedSession, fetchProposals, voteForProposal } from './api';

const queryKey = (eventId: string, userId: string): readonly unknown[] =>
  ['agenda', 'proposals', eventId, userId] as const;

export function useProposals(eventId: string): {
  proposals: ProposedSession[];
  isLoading: boolean;
  error: Error | null;
  vote: (proposal: ProposedSession) => void;
  isVoting: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(eventId, userId ?? 'anon'),
    enabled: userId !== null,
    queryFn: () => {
      if (!userId) return Promise.resolve([] as ProposedSession[]);
      return fetchProposals(getSupabaseClient(), { eventId, userId });
    },
  });

  const mutation = useMutation({
    mutationFn: async (proposal: ProposedSession) => {
      if (!userId) return;
      await voteForProposal(getSupabaseClient(), { sessionId: proposal.id, userId });
    },
    onMutate: async (proposal) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: queryKey(eventId, userId) });
      const previous = queryClient.getQueryData<ProposedSession[]>(queryKey(eventId, userId));
      if (previous) {
        queryClient.setQueryData<ProposedSession[]>(
          queryKey(eventId, userId),
          previous.map((p) =>
            p.id === proposal.id ? { ...p, has_voted: true, vote_count: p.vote_count + 1 } : p,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _proposal, ctx) => {
      if (!userId || !ctx?.previous) return;
      queryClient.setQueryData(queryKey(eventId, userId), ctx.previous);
    },
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKey(eventId, userId) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agenda', 'proposals'] });
    },
  });

  return {
    proposals: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
    vote: (proposal) => mutation.mutate(proposal),
    isVoting: mutation.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
}
