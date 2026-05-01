import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/', i18nKey: 'nav.home' },
  { to: '/itinerary', i18nKey: 'nav.itinerary' },
  { to: '/documents', i18nKey: 'nav.documents' },
  { to: '/community', i18nKey: 'nav.community' },
] as const;

export function HeaderNav(): JSX.Element {
  const { t } = useTranslation();
  return (
    <nav className="hidden items-center gap-6 md:flex">
      {LINKS.map((link) => (
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
  );
}
