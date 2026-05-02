import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';

import { createApiKey, listApiKeys, revokeApiKey } from './api';
import type { ApiKeyScope } from './types';

const apiKeysQueryKey = ['api-keys'] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeysQueryKey,
    queryFn: () => listApiKeys(getSupabaseClient()),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; scope: ApiKeyScope; expiresAt: string | null }) =>
      createApiKey(getSupabaseClient(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeApiKey(getSupabaseClient(), id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}
