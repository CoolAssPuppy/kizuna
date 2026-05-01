import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';

/**
 * Three-dot menu trigger in the header. Opens a dropdown with profile
 * navigation and sign-out. Click-outside closes the menu.
 */
export function HeaderUserMenu(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return <div className="h-9 w-9" aria-hidden />;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.avatarMenu')}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">{user.email}</div>
          <MenuItem
            label={t('profile.title')}
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          />
          <MenuItem
            label={t('header.editProfile')}
            onClick={() => {
              setOpen(false);
              navigate('/profile/edit');
            }}
          />
          <MenuItem
            label={t('auth.signOut')}
            onClick={() => void signOut()}
            variant="destructive"
          />
        </div>
      ) : null}
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
