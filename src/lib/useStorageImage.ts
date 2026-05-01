import { useEffect, useState } from 'react';

import { getSupabaseClient } from './supabase';

interface Options {
  /** Seconds until the signed URL expires. Defaults to 1 hour. */
  ttlSeconds?: number;
}

/**
 * Resolves a Storage object path to a signed URL. Returns null while loading
 * or when `path` is null/empty. Tracks the latest path so race conditions on
 * rapid prop changes don't surface a stale URL.
 */
export function useStorageImage(
  bucket: string,
  path: string | null | undefined,
  options: Options = {},
): string | null {
  const { ttlSeconds = 3600 } = options;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    void (async () => {
      const { data } = await getSupabaseClient().storage.from(bucket).createSignedUrl(path, ttlSeconds);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [bucket, path, ttlSeconds]);

  return url;
}
