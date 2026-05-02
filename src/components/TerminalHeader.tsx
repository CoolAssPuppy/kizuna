import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { APP_VERSION, BUILD_SHA } from '@/lib/buildInfo';

import { HeaderUserMenu } from './HeaderUserMenu';
import { MobileNav } from './MobileNav';

const NAV = [
  { to: '/', i18nKey: 'nav.home', label: 'home' },
  { to: '/itinerary', i18nKey: 'nav.itinerary', label: 'itinerary' },
  { to: '/agenda', i18nKey: 'nav.agenda', label: 'agenda' },
  { to: '/registration', i18nKey: 'nav.registration', label: 'registration' },
  { to: '/documents', i18nKey: 'nav.documents', label: 'documents' },
  { to: '/community', i18nKey: 'nav.community', label: 'community' },
] as const;

function eventSlug(
  name: string | null | undefined,
  location: string | null | undefined,
  startDate: string | null | undefined,
): string {
  const base = (location ?? name ?? 'event').toLowerCase().trim();
  const slug = base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const year = startDate ? new Date(startDate).getUTCFullYear() : new Date().getUTCFullYear();
  return `${slug}_${year}`;
}

const BUILD_LABEL = BUILD_SHA.slice(0, 7);

export function TerminalHeader(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { data: event } = useActiveEvent();
  const slug = eventSlug(event?.name, event?.location, event?.start_date);

  const links = isAdmin ? [...NAV, { to: '/admin', i18nKey: 'nav.admin', label: 'admin' }] : NAV;

  return (
    <header
      className="border-b"
      style={{ backgroundColor: 'var(--c-bg)', borderColor: 'var(--c-rule)' }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-3 whitespace-nowrap text-[13px]">
          <span className="font-bold" style={{ color: 'var(--c-accent)' }}>
            ~/kizuna
          </span>
          <span className="hidden sm:inline" style={{ color: 'var(--c-dim)' }}>
            $
          </span>
          <span className="hidden sm:inline" style={{ color: 'var(--c-muted)' }}>
            cd ~/{slug}
          </span>
        </Link>

        {user ? (
          <nav
            aria-label={t('nav.label', { defaultValue: 'Primary' })}
            className="hidden items-center gap-6 lg:flex"
          >
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === '/'} className="text-xs lowercase">
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
          <span
            className="hidden text-[11px] xl:inline"
            style={{ color: 'var(--c-dim)' }}
          >
            v{APP_VERSION} · build {BUILD_LABEL}
          </span>
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
