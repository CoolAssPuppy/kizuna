import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { ensureRegistration } from './api';
import type { RegistrationBundle } from './types';

const registrationKey = (eventId: string, userId: string): readonly unknown[] =>
  ['registration', eventId, userId] as const;

interface Args {
  eventId: string;
}

export function useRegistration({ eventId }: Args): {
  data: RegistrationBundle | undefined;
  isLoading: boolean;
  error: Error | null;
  invalidate: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: registrationKey(eventId, userId ?? 'anon'),
    enabled: userId !== null,
    queryFn: () => {
      if (userId === null) {
        return Promise.reject(new Error('Cannot load registration without an authenticated user'));
      }
      return ensureRegistration(getSupabaseClient(), { userId, eventId });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error ?? null,
    invalidate: () => {
      void queryClient.invalidateQueries({
        queryKey: registrationKey(eventId, userId ?? 'anon'),
      });
    },
  };
}
