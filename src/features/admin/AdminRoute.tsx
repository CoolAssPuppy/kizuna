import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useIsAdmin } from '@/features/auth/hooks';

import { AdminLayout } from './AdminLayout';
import { ComingSoon } from './ComingSoon';
import { ConflictsScreen } from './ConflictsScreen';
import { EventEditScreen } from './EventEditScreen';
import { EventsListScreen } from './EventsListScreen';
import { ReportsScreen } from './ReportsScreen';

export function AdminRoute(): JSX.Element {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {t('admin.blocked')}
        </p>
      </main>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="events" replace />} />
        <Route path="events" element={<EventsListScreen />} />
        <Route path="events/new" element={<EventEditScreen />} />
        <Route path="events/:eventId" element={<EventEditScreen />} />
        <Route
          path="agenda"
          element={
            <ComingSoon titleKey="admin.agenda.title" subtitleKey="admin.agenda.subtitle" />
          }
        />
        <Route
          path="documents"
          element={
            <ComingSoon
              titleKey="admin.documents.title"
              subtitleKey="admin.documents.subtitle"
            />
          }
        />
        <Route
          path="stats"
          element={<ComingSoon titleKey="admin.stats.title" subtitleKey="admin.stats.subtitle" />}
        />
        <Route
          path="nudges"
          element={<ComingSoon titleKey="admin.nudges.title" subtitleKey="admin.nudges.subtitle" />}
        />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="conflicts" element={<ConflictsScreen />} />
      </Route>
    </Routes>
  );
}
