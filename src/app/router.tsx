import { Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { ConsentRoute } from '@/features/documents/ConsentRoute';
import { DocumentsRoute } from '@/features/documents/DocumentsRoute';
import { NotFound } from '@/features/errors/NotFound';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInScreen />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
