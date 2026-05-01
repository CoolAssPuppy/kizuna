import { useEffect, useState } from 'react';

import { getSupabaseClient } from '@/lib/supabase';

const BUCKET = 'avatars';

interface Props {
  /** Storage object path (avatars/<uid>/avatar.jpg) or absolute URL or null. */
  url: string | null;
  /** 2-character fallback when no avatar is available. */
  fallback: string;
  /** Diameter in CSS pixels. Defaults to 32. */
  size?: number;
}

/**
 * Renders an attendee avatar at any size. Supports:
 *   - null → initial-tile fallback
 *   - absolute URL → <img>
 *   - storage object path → resolves a signed URL on mount
 */
export function Avatar({ url, fallback, size = 32 }: Props): JSX.Element {
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSigned(null);
      return;
    }
    if (url.startsWith('http')) {
      setSigned(url);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await getSupabaseClient()
        .storage.from(BUCKET)
        .createSignedUrl(url, 60 * 60);
      if (active) setSigned(data?.signedUrl ?? null);
    })();
    return () => {
      active = false;
    };
  }, [url]);

  const dim = `${size}px`;
  if (signed) {
    return (
      <img
        src={signed}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: dim, height: dim }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
      style={{ width: dim, height: dim, fontSize: size * 0.36 }}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </span>
  );
}
