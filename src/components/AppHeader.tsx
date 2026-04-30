import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { cn } from '@/lib/utils';

import { UserAvatar } from './UserAvatar';

const NAV_LINKS = [
  { to: '/', i18nKey: 'nav.home' },
  { to: '/itinerary', i18nKey: 'nav.itinerary' },
  { to: '/documents', i18nKey: 'nav.documents' },
  { to: '/community', i18nKey: 'nav.community' },
] as const;

export function AppHeader(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-8 py-3">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background"
            style={{ fontFamily: 'system-ui', fontWeight: 700, fontSize: 14 }}
          >
            絆
          </span>
          <span className="text-sm font-semibold">{t('app.name')}</span>
        </Link>

        {user ? (
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'text-sm transition-colors',
                    isActive
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {t(link.i18nKey)}
              </NavLink>
            ))}
          </nav>
        ) : null}

        {user ? <UserAvatar /> : <div className="h-9 w-9" aria-hidden />}
      </div>
    </header>
  );
}
