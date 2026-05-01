import { Route, Routes } from 'react-router-dom';

import { AdminRoute } from '@/features/admin/AdminRoute';
import { SharedReportScreen } from '@/features/admin/SharedReportScreen';
import { AgendaRoute } from '@/features/agenda/AgendaRoute';
import { useAuth } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { CommunityScreen } from '@/features/community/CommunityScreen';
import { ConsentRoute } from '@/features/documents/ConsentRoute';
import { CreateDocumentScreen } from '@/features/documents/CreateDocumentScreen';
import { DocumentsRoute } from '@/features/documents/DocumentsRoute';
import { SignDocumentScreen } from '@/features/documents/SignDocumentScreen';
import { NotFound } from '@/features/errors/NotFound';
import { AcceptInvitationScreen } from '@/features/guests/AcceptInvitationScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { ItineraryRoute } from '@/features/itinerary/ItineraryRoute';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { RegistrationRoute } from '@/features/registration/RegistrationRoute';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

/**
 * Home swap: signed-in users land on the dashboard; signed-out viewers
 * see the day/night hero. We avoid RequireAuth here because we don't
 * want the redirect — the welcome hero is the right answer for guests.
 */
function HomeRoute(): JSX.Element {
  const { status } = useAuth();
  return status === 'authenticated' ? <HomeScreen /> : <WelcomeScreen />;
}

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/accept-invitation" element={<AcceptInvitationScreen />} />
      <Route path="/" element={<HomeRoute />} />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfileScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/consent"
        element={
          <RequireAuth>
            <ConsentRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/documents"
        element={
          <RequireAuth>
            <DocumentsRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/documents/new"
        element={
          <RequireAuth allow={['admin', 'super_admin']}>
            <CreateDocumentScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/documents/:documentId/sign"
        element={
          <RequireAuth>
            <SignDocumentScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/itinerary"
        element={
          <RequireAuth>
            <ItineraryRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/agenda"
        element={
          <RequireAuth>
            <AgendaRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/registration"
        element={
          <RequireAuth>
            <RegistrationRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/registration/:stepPath"
        element={
          <RequireAuth>
            <RegistrationRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/community"
        element={
          <RequireAuth>
            <CommunityScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireAuth allow={['admin', 'super_admin']}>
            <AdminRoute />
          </RequireAuth>
        }
      />
      <Route path="/share/reports/:token" element={<SharedReportScreen />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
