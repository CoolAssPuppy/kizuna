import { useQuery } from '@tanstack/react-query';

import { getSupabaseClient } from './supabase';

interface Options {
  /** Seconds until the signed URL expires. Defaults to 1 hour. */
  ttlSeconds?: number;
}

/**
 * Resolves a Storage object path to a signed URL. Returns null while
 * loading or when `path` is null/empty. TanStack Query handles the
 * race-on-rapid-prop-change cancellation.
 */
export function useStorageImage(
  bucket: string,
  path: string | null | undefined,
  options: Options = {},
): string | null {
  const { ttlSeconds = 3600 } = options;
  const { data = null } = useQuery({
    queryKey: ['storage-signed-url', bucket, path, ttlSeconds],
    enabled: !!path,
    // Refresh well before the signed URL itself expires.
    staleTime: Math.floor(ttlSeconds * 0.5) * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data: signed } = await getSupabaseClient()
        .storage.from(bucket)
        .createSignedUrl(path, ttlSeconds);
      return signed?.signedUrl ?? null;
    },
  });
  return data;
}
