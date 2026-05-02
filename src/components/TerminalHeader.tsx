import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { NotificationBell } from '@/features/notifications/NotificationBell';

import { HeaderUserMenu } from './HeaderUserMenu';
import { MobileNav } from './MobileNav';

const NAV = [
  { to: '/', i18nKey: 'nav.home', label: 'home' },
  { to: '/itinerary', i18nKey: 'nav.itinerary', label: 'itinerary' },
  { to: '/agenda', i18nKey: 'nav.agenda', label: 'agenda' },
  { to: '/documents', i18nKey: 'nav.documents', label: 'documents' },
  { to: '/community', i18nKey: 'nav.community', label: 'community' },
] as const;

export function TerminalHeader(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <header
      className="border-b"
      style={{ backgroundColor: 'var(--c-bg)', borderColor: 'var(--c-rule)' }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 whitespace-nowrap text-[13px]"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center"
            style={{
              color: 'var(--c-fg)',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            絆
          </span>
          <span className="font-bold" style={{ color: 'var(--c-accent)' }}>
            ~/kizuna
          </span>
        </Link>

        {user ? (
          <nav
            aria-label={t('nav.label', { defaultValue: 'Primary' })}
            className="hidden items-center gap-6 lg:flex"
          >
            {NAV.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className="text-xs lowercase"
              >
                {({ isActive }) => (
                  <span
                    style={{
                      color: isActive ? 'var(--c-accent)' : 'var(--c-muted)',
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >
                    {isActive ? `[${t(link.i18nKey)}]` : t(link.i18nKey)}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-3.5">
          {user ? <NotificationBell /> : null}
          <HeaderUserMenu />
          {user ? (
            <span className="lg:hidden">
              <MobileNav />
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
