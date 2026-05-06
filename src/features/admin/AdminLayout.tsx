import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bed,
  Bus,
  CalendarRange,
  FileText,
  Info,
  Mail,
  Newspaper,
  ScanLine,
  Send,
  Shirt,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface NavSection {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  labelKey: string;
}

const SECTIONS: ReadonlyArray<NavSection> = [
  { to: '/admin/about', icon: Info, labelKey: 'admin.nav.about' },
  { to: '/admin/invitations', icon: Mail, labelKey: 'admin.nav.invitations' },
  { to: '/admin/agenda', icon: CalendarRange, labelKey: 'admin.nav.agenda' },
  { to: '/admin/feed', icon: Newspaper, labelKey: 'admin.nav.feed' },
  { to: '/admin/documents', icon: FileText, labelKey: 'admin.nav.documents' },
  { to: '/admin/swag', icon: Shirt, labelKey: 'admin.nav.swag' },
  { to: '/admin/stats', icon: BarChart3, labelKey: 'admin.nav.stats' },
  { to: '/admin/nudges', icon: Send, labelKey: 'admin.nav.communication' },
  { to: '/admin/reports', icon: Users, labelKey: 'admin.nav.reports' },
  { to: '/admin/ground-transport', icon: Bus, labelKey: 'admin.nav.groundTransport' },
  { to: '/admin/rooms', icon: Bed, labelKey: 'admin.nav.roomAssignment' },
  { to: '/admin/scan', icon: ScanLine, labelKey: 'admin.nav.scanQr' },
];

export function AdminLayout(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="px-3 pb-3 text-2xl font-semibold tracking-tight md:hidden">
        {t('admin.title')}
      </h1>

      {/* Mobile: horizontally scrollable pill nav above the content. */}
      <nav
        aria-label={t('admin.nav.label')}
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 md:hidden"
        style={{ scrollbarWidth: 'thin' }}
      >
        {SECTIONS.map(({ to, end, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            {...(end !== undefined ? { end } : {})}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent',
              )
            }
          >
            <Icon aria-hidden className="h-4 w-4" />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 space-y-1 md:block">
          <h1 className="px-3 pb-3 text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
          <nav className="flex flex-col gap-0.5" aria-label={t('admin.nav.label')}>
            {SECTIONS.map(({ to, end, icon: Icon, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                {...(end !== undefined ? { end } : {})}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon aria-hidden className="h-4 w-4" />
                <span>{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
