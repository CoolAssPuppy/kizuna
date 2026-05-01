import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useIsAdmin } from '@/features/auth/hooks';

import { AdminLayout } from './AdminLayout';
import { AgendaAdminScreen } from './AgendaAdminScreen';
import { ArrivalsScreen } from './ArrivalsScreen';
import { ConflictsScreen } from './ConflictsScreen';
import { DocumentsScreen } from './DocumentsScreen';
import { EventEditScreen } from './EventEditScreen';
import { FeedScreen } from './FeedScreen';
import { NudgesScreen } from './NudgesScreen';
import { ReportsScreen } from './ReportsScreen';
import { StatsScreen } from './StatsScreen';

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
        <Route index element={<Navigate to="agenda" replace />} />
        <Route path="events" element={<Navigate to="/all-events" replace />} />
        <Route path="events/new" element={<EventEditScreen />} />
        <Route path="events/:eventId" element={<EventEditScreen />} />
        <Route path="agenda" element={<AgendaAdminScreen />} />
        <Route path="arrivals" element={<ArrivalsScreen />} />
        <Route path="feed" element={<FeedScreen />} />
        <Route path="documents" element={<DocumentsScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="nudges" element={<NudgesScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="conflicts" element={<ConflictsScreen />} />
      </Route>
    </Routes>
  );
}
