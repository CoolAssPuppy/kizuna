import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { listAdditionalGuests } from './api';

type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];

/** Canonical query key. Exported so other hooks can invalidate by prefix. */
export const additionalGuestsKey = (userId: string | null): readonly unknown[] =>
  ['additional-guests', userId] as const;

/**
 * Loads the additional_guests rows the caller sponsors. The query stays
 * disabled (and `data` stays undefined) while the user id is null so a
 * pre-auth render doesn't fire an empty-id request. RLS scopes the read.
 */
export function useAdditionalGuests(userId: string | null): UseQueryResult<AdditionalGuestRow[]> {
  return useQuery({
    queryKey: additionalGuestsKey(userId),
    enabled: userId !== null,
    queryFn: () => listAdditionalGuests(getSupabaseClient(), userId!),
  });
}
