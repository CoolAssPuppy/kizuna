import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
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

export function ProfileAvatar({ size = 80 }: ProfileAvatarProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseClient();
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('employee_profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      const stored = data?.avatar_url;
      if (typeof stored === 'string' && stored.length > 0) {
        const { data: signed } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(stored, 60 * 60);
        if (active) setAvatarUrl(signed?.signedUrl ?? null);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleUpload(file: File): Promise<void> {
    if (!user) return;
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const upload = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upload.error) return;
      await supabase.from('employee_profiles').update({ avatar_url: path }).eq('user_id', user.id);
      const { data: signed } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path, 60 * 60);
      setAvatarUrl(signed?.signedUrl ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
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
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-semibold">{initialsFor(user?.email)}</span>
        )}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity',
            busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
          aria-hidden
        >
          {busy ? (
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
          if (file) void handleUpload(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
