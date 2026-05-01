import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useAuth } from '@/features/auth/AuthContext';

interface Props {
  children: ReactNode;
}

/**
 * Routes that always render minimal chrome regardless of auth state.
 * Sign-in, accept-invitation, and shared report links are immersive
 * flows — the share recipient is a hotel/transport coordinator who
 * has no app account and does not need our header or footer.
 */
const ALWAYS_BARE_PATHS = new Set<string>(['/sign-in', '/accept-invitation']);
const ALWAYS_BARE_PREFIXES = ['/share/'];

export function AppLayout({ children }: Props): JSX.Element {
  const { pathname } = useLocation();
  const { status } = useAuth();
  const alwaysBare =
    ALWAYS_BARE_PATHS.has(pathname) || ALWAYS_BARE_PREFIXES.some((p) => pathname.startsWith(p));
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
      <OfflineBanner />
      <AppHeader />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
