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
 * Sign-in and accept-invitation are immersive auth flows; shared report
 * links are immersive too — the share recipient is a hotel/transport
 * coordinator who has no app account and does not need our header or
 * footer.
 */
const AUTH_PATHS = new Set<string>(['/sign-in', '/accept-invitation']);
const ALWAYS_BARE_PREFIXES = ['/share/'];

export function AppLayout({ children }: Props): JSX.Element {
  const { pathname } = useLocation();
  const { status } = useAuth();
  const isAuth = AUTH_PATHS.has(pathname);
  const alwaysBare = isAuth || ALWAYS_BARE_PREFIXES.some((p) => pathname.startsWith(p));
  const signedOut = status === 'unauthenticated';

  const bare = alwaysBare || signedOut;

  if (isAuth) {
    return (
      <div
        className="relative min-h-screen bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/auth.jpg)' }}
      >
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" aria-hidden />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

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
