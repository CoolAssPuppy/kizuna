import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';
import { useMountEffect } from '@/hooks/useMountEffect';
import { cn } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabase';

interface NavLinkSpec {
  readonly to: string;
  readonly i18nKey: string;
  readonly end?: boolean;
}

const NAV_LINKS: ReadonlyArray<NavLinkSpec> = [
  { to: '/', i18nKey: 'nav.home', end: true },
  { to: '/itinerary', i18nKey: 'nav.itinerary' },
  { to: '/agenda', i18nKey: 'nav.agenda' },
  { to: '/documents', i18nKey: 'nav.documents' },
  { to: '/community', i18nKey: 'nav.community' },
];

function initialsFor(email: string | undefined): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

/**
 * Single avatar-anchored menu. On lg+ the top nav owns navigation and this
 * dropdown only carries account actions. Below lg the same dropdown also
 * exposes the primary nav links — eliminating the second hamburger on
 * mobile.
 */
export function HeaderUserMenu(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const close = (): void => setOpen(false);

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
        <DropdownPanel containerRef={containerRef} onDismiss={close}>
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">{user.email}</div>
          <div className="lg:hidden">
            <nav aria-label={t('nav.label')} className="flex flex-col py-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  {...(link.end !== undefined ? { end: link.end } : {})}
                  onClick={close}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-foreground hover:bg-accent',
                    )
                  }
                >
                  {t(link.i18nKey)}
                </NavLink>
              ))}
            </nav>
            <div className="border-t" />
          </div>
          <MenuItem
            label={t('profile.title')}
            active={pathname === '/profile'}
            onClick={() => {
              close();
              navigate('/profile');
            }}
          />
          {isAdmin ? (
            <>
              <MenuItem
                label={t('nav.admin')}
                active={pathname.startsWith('/admin')}
                onClick={() => {
                  close();
                  navigate('/admin');
                }}
              />
              <MenuItem
                label={t('nav.allEvents')}
                active={pathname.startsWith('/all-events')}
                onClick={() => {
                  close();
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
  useMountEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  });
  return (
    <div
      role="menu"
      className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {children}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  active?: boolean;
}

function MenuItem({
  label,
  onClick,
  variant = 'default',
  active = false,
}: MenuItemProps): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent',
        active && 'bg-accent font-medium text-accent-foreground',
        variant === 'destructive' && 'text-destructive',
      )}
    >
      {label}
    </button>
  );
}
