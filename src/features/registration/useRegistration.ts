import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { ensureRegistration } from './api';
import type { RegistrationBundle } from './types';

const registrationKey = (eventId: string, userId: string): readonly unknown[] =>
  ['registration', eventId, userId] as const;

interface Args {
  /**
   * Active event id. Pass `null` while the active event is still loading
   * (or the screen has no event in scope) — the query stays disabled and
   * `data` stays `undefined` until a real id arrives. Avoids round trips
   * with empty-string event ids that would 400 on the FK insert.
   */
  eventId: string | null;
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
  const enabled = userId !== null && eventId !== null;

  const query = useQuery({
    queryKey: registrationKey(eventId ?? 'no-event', userId ?? 'anon'),
    enabled,
    queryFn: () => {
      if (userId === null || eventId === null) {
        return Promise.reject(new Error('Cannot load registration without user + event'));
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
        queryKey: registrationKey(eventId ?? 'no-event', userId ?? 'anon'),
      });
    },
  };
}
