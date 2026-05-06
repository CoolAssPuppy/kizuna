import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useIsAdmin } from '@/features/auth/hooks';

import { AboutScreen } from './AboutScreen';
import { AdminLayout } from './AdminLayout';
import { AgendaAdminScreen } from './agenda/AgendaAdminScreen';
import { ConflictsScreen } from './conflicts/ConflictsScreen';
import { DocumentsScreen } from './documents/DocumentsScreen';
import { EventEditScreen } from './events/EventEditScreen';
import { FeedScreen } from './feed/FeedScreen';
import { GroundTransportToolScreen } from './ground-transport/GroundTransportToolScreen';
import { InvitationsScreen } from './invitations/InvitationsScreen';
import { NudgesScreen } from './nudges/NudgesScreen';
import { ReportsScreen } from './reports/ReportsScreen';
import { RoomAssignmentToolScreen } from './room-assignment/RoomAssignmentToolScreen';
import { ScanQrScreen } from './scan/ScanQrScreen';
import { StatsScreen } from './stats/StatsScreen';
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
