import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  FileText,
  Hotel,
  Newspaper,
  PlaneLanding,
  Send,
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
  { to: '/admin/agenda', icon: CalendarRange, labelKey: 'admin.nav.agenda' },
  { to: '/admin/ground-transport', icon: PlaneLanding, labelKey: 'admin.nav.groundTransport' },
  { to: '/admin/rooms', icon: Hotel, labelKey: 'admin.nav.roomAssignment' },
  { to: '/admin/feed', icon: Newspaper, labelKey: 'admin.nav.feed' },
  { to: '/admin/documents', icon: FileText, labelKey: 'admin.nav.documents' },
  { to: '/admin/stats', icon: BarChart3, labelKey: 'admin.nav.stats' },
  { to: '/admin/nudges', icon: Send, labelKey: 'admin.nav.nudges' },
  { to: '/admin/reports', icon: Users, labelKey: 'admin.nav.reports' },
  { to: '/admin/conflicts', icon: AlertTriangle, labelKey: 'admin.nav.conflicts' },
];

export function AdminLayout(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-8 px-8 py-10">
      <aside className="w-56 shrink-0 space-y-1">
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
  );
}
