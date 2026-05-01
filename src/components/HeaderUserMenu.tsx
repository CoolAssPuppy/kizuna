import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';
import { useMountEffect } from '@/hooks/useMountEffect';
import { getSupabaseClient } from '@/lib/supabase';

function initialsFor(email: string | undefined): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function HeaderUserMenu(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pull the avatar storage path from the signed-in employee_profiles
  // row. Shared cache key with ProfileAvatar so opening Profile and
  // closing it doesn't double-fetch.
  const { data: avatarPath = null } = useQuery({
    queryKey: ['employee-profile-avatar-path', user?.id ?? null],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await getSupabaseClient()
        .from('employee_profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.avatar_url ?? null;
    },
  });

  if (!user) return <div className="h-9 w-9" aria-hidden />;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.avatarMenu')}
        className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-background hover:ring-2 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar url={avatarPath} fallback={initialsFor(user.email)} size={32} />
      </button>
      {open ? (
        <DropdownPanel containerRef={containerRef} onDismiss={() => setOpen(false)}>
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">{user.email}</div>
          <MenuItem
            label={t('profile.title')}
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          />
          {isAdmin ? (
            <>
              <MenuItem
                label={t('nav.admin')}
                onClick={() => {
                  setOpen(false);
                  navigate('/admin');
                }}
              />
              <MenuItem
                label={t('nav.allEvents')}
                onClick={() => {
                  setOpen(false);
                  navigate('/all-events');
                }}
              />
            </>
          ) : null}
          <MenuItem
            label={t('auth.signOut')}
            onClick={() => void signOut()}
            variant="destructive"
          />
        </DropdownPanel>
      ) : null}
    </div>
  );
}

function DropdownPanel({
  containerRef,
  onDismiss,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  onDismiss: () => void;
  children: React.ReactNode;
}): JSX.Element {
  // Listener attaches only while the panel is mounted; closing
  // unmounts the panel, which detaches the listener.
  useMountEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  });
  return (
    <div
      role="menu"
      className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {children}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

function MenuItem({ label, onClick, variant = 'default' }: MenuItemProps): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={
        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent ' +
        (variant === 'destructive' ? 'text-destructive' : '')
      }
    >
      {label}
    </button>
  );
}
