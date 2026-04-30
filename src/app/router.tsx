import { Route, Routes } from 'react-router-dom';

import { AdminRoute } from '@/features/admin/AdminRoute';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { CommunityScreen } from '@/features/community/CommunityScreen';
import { ConsentRoute } from '@/features/documents/ConsentRoute';
import { DocumentsRoute } from '@/features/documents/DocumentsRoute';
import { NotFound } from '@/features/errors/NotFound';
import { AcceptInvitationScreen } from '@/features/guests/AcceptInvitationScreen';
import { ItineraryRoute } from '@/features/itinerary/ItineraryRoute';
import { EditProfileScreen } from '@/features/profile/EditProfileScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { RegistrationRoute } from '@/features/registration/RegistrationRoute';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/accept-invitation" element={<AcceptInvitationScreen />} />
      <Route path="/" element={<WelcomeScreen />} />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfileScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <RequireAuth>
            <EditProfileScreen />
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
        path="/itinerary"
        element={
          <RequireAuth>
            <ItineraryRoute />
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
        path="/admin"
        element={
          <RequireAuth allow={['admin', 'super_admin']}>
            <AdminRoute />
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
