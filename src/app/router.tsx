import { Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInScreen } from '@/features/auth/SignInScreen';
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
