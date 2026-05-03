import { useQuery } from '@tanstack/react-query';
import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const AVATAR_BUCKET = 'avatars';

function initialsFor(email: string | undefined): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

interface ProfileAvatarProps {
  /** Pixel size of the avatar circle. Defaults to 80. */
  size?: number;
}

/**
 * Click-the-circle avatar uploader. Shares its upload mechanics with the
 * rest of the app via `useSupabaseUpload`, but keeps the single-target
 * "click image, pick file, see new image" flow rather than the multi-file
 * drag-drop UI used elsewhere — for an avatar it's the right interaction.
 */
export function ProfileAvatar({ size = 80 }: ProfileAvatarProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Local override wins after a fresh upload — used until the next
  // page load when the query cache picks up the new avatar_url.
  const [overrideUrl, setOverrideUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: queriedUrl = null } = useQuery({
    queryKey: ['profile-avatar', user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('employee_profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      const stored = data?.avatar_url;
      if (typeof stored !== 'string' || stored.length === 0) return null;
      const { data: signed } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(stored, 60 * 60);
      return signed?.signedUrl ?? null;
    },
  });
  const avatarUrl = overrideUrl ?? queriedUrl;

  const upload = useSupabaseUpload({
    bucketName: AVATAR_BUCKET,
    ...(user ? { path: user.id } : {}),
    maxFiles: 1,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    upsert: true,
    onUploadComplete: (paths) => {
      const next = paths[0];
      if (!next || !user) return;
      void (async () => {
        const client = getSupabaseClient();
        await client.from('employee_profiles').update({ avatar_url: next }).eq('user_id', user.id);
        const { data: signed } = await client.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(next, 60 * 60);
        setOverrideUrl(signed?.signedUrl ?? null);
        upload.setFiles([]);
      })();
    },
  });

  // useEffect (not useMountEffect) because `upload.onUpload` reads its
  // `files` state from closure and only sees the freshly-set value
  // after a re-render. Restructuring useSupabaseUpload to take files
  // as an argument is a separate refactor.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (upload.files.length > 0 && !upload.loading && upload.successes.length === 0) {
      void upload.onUpload();
    }
  }, [upload]);

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.loading}
        aria-label={t('header.uploadAvatar')}
        title={t('header.uploadAvatar')}
        className={cn(
          'group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary text-secondary-foreground',
          'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-progress',
        )}
        style={{ height: size, width: size }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg font-semibold">{initialsFor(user?.email)}</span>
        )}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity',
            upload.loading
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
          aria-hidden
        >
          {upload.loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !user) return;
          // Rename the file to a stable key per user so the upsert lands on
          // the same object every time. Keeps the avatars bucket from
          // accumulating one row per upload.
          const ext = file.name.split('.').pop() ?? 'bin';
          const renamed = new File([file], `avatar.${ext}`, { type: file.type });
          (renamed as File & { errors: never[] }).errors = [];
          upload.setFiles([Object.assign(renamed, { errors: [] as never[] })]);
          event.target.value = '';
        }}
      />
    </>
  );
}
