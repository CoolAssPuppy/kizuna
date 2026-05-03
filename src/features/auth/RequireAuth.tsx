import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';
import { hasRole } from './hooks';
import type { AppRole } from './types';

interface RequireAuthProps {
  children: ReactNode;
  /** When set, the user must have one of these roles. */
  allow?: ReadonlyArray<AppRole>;
  /** Redirect target when unauthenticated. Defaults to /sign-in. */
  redirectTo?: string;
}

export function RequireAuth({
  children,
  allow,
  redirectTo = '/sign-in',
}: RequireAuthProps): JSX.Element {
  const { status, user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  if (allow && !hasRole(user.role, allow)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
