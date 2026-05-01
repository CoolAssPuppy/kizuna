import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

function initialsFor(email: string | undefined): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function ProfileAvatar(): JSX.Element {
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
    const supabase = getSupabaseClient();
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const upload = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upload.error) {
      setBusy(false);
      return;
    }
    await supabase.from('employee_profiles').update({ avatar_url: path }).eq('user_id', user.id);
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 60);
    setAvatarUrl(signed?.signedUrl ?? null);
    setBusy(false);
  }

  return (
    <div className="flex flex-row items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-secondary text-secondary-foreground">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-semibold">{initialsFor(user?.email)}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{user?.email}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {t('header.uploadAvatar')}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />
    </div>
  );
}
