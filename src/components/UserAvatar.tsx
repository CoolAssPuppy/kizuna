import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const AVATAR_BUCKET = 'avatars';

function initialsFor(email: string | undefined): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function UserAvatar(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Close menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

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
    setMenuOpen(false);
  }

  const initials = initialsFor(user?.email);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t('header.avatarMenu')}
        className={cn(
          'flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-secondary text-secondary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold">{initials}</span>
        )}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {user ? (
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">{user.email}</div>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              navigate('/profile/edit');
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
          >
            {t('header.editProfile')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
          >
            {t('header.uploadAvatar')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
          >
            {t('auth.signOut')}
          </button>
        </div>
      ) : null}

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
