import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useIsAdmin } from '@/features/auth/hooks';

import { AboutScreen } from './AboutScreen';
import { AdminLayout } from './AdminLayout';
import { AgendaAdminScreen } from './AgendaAdminScreen';
import { ConflictsScreen } from './ConflictsScreen';
import { DocumentsScreen } from './DocumentsScreen';
import { EventEditScreen } from './EventEditScreen';
import { FeedScreen } from './FeedScreen';
import { GroundTransportToolScreen } from './GroundTransportToolScreen';
import { InvitationsScreen } from './invitations/InvitationsScreen';
import { NudgesScreen } from './NudgesScreen';
import { ReportsScreen } from './ReportsScreen';
import { RoomAssignmentToolScreen } from './RoomAssignmentToolScreen';
import { ScanQrScreen } from './ScanQrScreen';
import { StatsScreen } from './StatsScreen';
import { SwagAdminScreen } from './swag/SwagAdminScreen';

export function AdminRoute(): JSX.Element {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {t('admin.blocked')}
        </p>
      </main>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="about" replace />} />
        <Route path="about" element={<AboutScreen />} />
        <Route path="invitations" element={<InvitationsScreen />} />
        <Route path="events" element={<Navigate to="/all-events" replace />} />
        <Route path="events/new" element={<EventEditScreen />} />
        <Route path="events/:eventId" element={<EventEditScreen />} />
        <Route path="agenda" element={<AgendaAdminScreen />} />
        <Route path="ground-transport" element={<GroundTransportToolScreen />} />
        <Route path="rooms" element={<RoomAssignmentToolScreen />} />
        <Route path="scan" element={<ScanQrScreen />} />
        <Route path="arrivals" element={<Navigate to="/admin/ground-transport" replace />} />
        <Route
          path="itinerary-analyzer"
          element={<Navigate to="/admin/ground-transport" replace />}
        />
        <Route path="feed" element={<FeedScreen />} />
        <Route path="documents" element={<DocumentsScreen />} />
        <Route path="swag" element={<SwagAdminScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="nudges" element={<NudgesScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="conflicts" element={<ConflictsScreen />} />
      </Route>
    </Routes>
  );
}
