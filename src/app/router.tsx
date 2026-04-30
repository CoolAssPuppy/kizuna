import { Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { ConsentRoute } from '@/features/documents/ConsentRoute';
import { DocumentsRoute } from '@/features/documents/DocumentsRoute';
import { NotFound } from '@/features/errors/NotFound';
import { AcceptInvitationScreen } from '@/features/guests/AcceptInvitationScreen';
import { ItineraryRoute } from '@/features/itinerary/ItineraryRoute';
import { RegistrationRoute } from '@/features/registration/RegistrationRoute';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/accept-invitation" element={<AcceptInvitationScreen />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <WelcomeScreen />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
