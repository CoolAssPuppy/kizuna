import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { useAuth } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { NotFound } from '@/features/errors/NotFound';
import { AcceptInvitationScreen } from '@/features/guests/AcceptInvitationScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

// Heavy routes are lazy-loaded so the initial bundle stays focused on
// home + auth. Each chunk picks up its own admin / agenda / itinerary
// dependency tree (recharts, react-markdown, etc.) only when navigated.
const AdminRoute = lazy(() =>
  import('@/features/admin/AdminRoute').then((m) => ({ default: m.AdminRoute })),
);
const SharedReportScreen = lazy(() =>
  import('@/features/admin/SharedReportScreen').then((m) => ({
    default: m.SharedReportScreen,
  })),
);
const AgendaRoute = lazy(() =>
  import('@/features/agenda/AgendaRoute').then((m) => ({ default: m.AgendaRoute })),
);
const CommunityScreen = lazy(() =>
  import('@/features/community/CommunityScreen').then((m) => ({
    default: m.CommunityScreen,
  })),
);
const ConsentRoute = lazy(() =>
  import('@/features/documents/ConsentRoute').then((m) => ({ default: m.ConsentRoute })),
);
const CreateDocumentScreen = lazy(() =>
  import('@/features/documents/CreateDocumentScreen').then((m) => ({
    default: m.CreateDocumentScreen,
  })),
);
const DocumentsRoute = lazy(() =>
  import('@/features/documents/DocumentsRoute').then((m) => ({ default: m.DocumentsRoute })),
);
const SignDocumentScreen = lazy(() =>
  import('@/features/documents/SignDocumentScreen').then((m) => ({
    default: m.SignDocumentScreen,
  })),
);
const AllEventsScreen = lazy(() =>
  import('@/features/events/AllEventsScreen').then((m) => ({ default: m.AllEventsScreen })),
);
const ItineraryRoute = lazy(() =>
  import('@/features/itinerary/ItineraryRoute').then((m) => ({ default: m.ItineraryRoute })),
);
const ProfileScreen = lazy(() =>
  import('@/features/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
);
const RegistrationRoute = lazy(() =>
  import('@/features/registration/RegistrationRoute').then((m) => ({
    default: m.RegistrationRoute,
  })),
);

/**
 * Home swap: signed-in users land on the dashboard; signed-out viewers
 * see the day/night hero. We avoid RequireAuth here because we don't
 * want the redirect — the welcome hero is the right answer for guests.
 */
function HomeRoute(): JSX.Element {
  const { status } = useAuth();
  return status === 'authenticated' ? <HomeScreen /> : <WelcomeScreen />;
}

function RouteFallback(): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-xl items-center justify-center px-6 py-20">
      <p className="text-sm text-muted-foreground" aria-busy="true">
        {t('app.loading')}
      </p>
    </main>
  );
}

export function AppRouter(): JSX.Element {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
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
          <Route
            path="/all-events"
            element={
              <RequireAuth allow={['admin', 'super_admin']}>
                <AllEventsScreen />
              </RequireAuth>
            }
          />
          <Route path="/share/reports/:token" element={<SharedReportScreen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
