import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/features/auth/AuthContext';

interface Props {
  children: ReactNode;
}

/**
 * Routes that always render minimal chrome regardless of auth state.
 * Sign-in and the guest accept page are immersive flows.
 */
const ALWAYS_BARE_PATHS = new Set<string>(['/sign-in', '/accept-invitation']);

export function AppLayout({ children }: Props): JSX.Element {
  const { pathname } = useLocation();
  const { status } = useAuth();
  const alwaysBare = ALWAYS_BARE_PATHS.has(pathname);
  const signedOut = status === 'unauthenticated';

  // Sign-in and accept-invitation always run bare. Otherwise: signed-in
  // visitors get header + footer everywhere; signed-out visitors get
  // nothing (the home hero stands on its own).
  const bare = alwaysBare || signedOut;

  if (bare) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
