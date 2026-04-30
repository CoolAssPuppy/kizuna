import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { acknowledge, fetchDocuments } from './api';
import type { AcknowledgePayload, DocumentWithAck } from './types';

interface DocumentsQueryArgs {
  eventId: string;
}

const documentsKey = (eventId: string, userId: string): readonly unknown[] =>
  ['documents', eventId, userId] as const;

/**
 * Loads documents + acknowledgements for the current user against a given event.
 * Returns an empty array (not an error) when the user is unauthenticated so
 * the calling component can render gracefully.
 */
export function useDocumentsQuery({ eventId }: DocumentsQueryArgs): {
  data: DocumentWithAck[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const audience = user?.role === 'guest' ? ('guest' as const) : ('employee' as const);

  const query = useQuery({
    queryKey: documentsKey(eventId, userId ?? 'anon'),
    enabled: userId !== null,
    queryFn: () => {
      if (userId === null) {
        throw new Error('useDocumentsQuery ran without an authenticated user');
      }
      return fetchDocuments(getSupabaseClient(), { eventId, userId, audience });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}

interface AcknowledgeArgs {
  eventId: string;
}

export function useAcknowledgeMutation({ eventId }: AcknowledgeArgs): {
  mutateAsync: (payload: Omit<AcknowledgePayload, 'userId' | 'eventId'>) => Promise<void>;
  isPending: boolean;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: Omit<AcknowledgePayload, 'userId' | 'eventId'>) => {
      if (!user) {
        throw new Error('Cannot acknowledge a document without an authenticated user');
      }
      await acknowledge(getSupabaseClient(), { ...payload, userId: user.id, eventId });
    },
    onSuccess: () => {
      const userId = user?.id ?? 'anon';
      void queryClient.invalidateQueries({ queryKey: documentsKey(eventId, userId) });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
