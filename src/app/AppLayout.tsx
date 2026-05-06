import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { CommandPalette } from '@/features/cli/CommandPalette';
import { useAuth } from '@/features/auth/AuthContext';

import { AppFooter } from './chrome/AppFooter';
import { FooterTerminal } from './chrome/FooterTerminal';
import { OfflineBanner } from './chrome/OfflineBanner';
import { TerminalHeader } from './chrome/TerminalHeader';
import { EventRouterGate } from './EventRouterGate';
import { GlobalRealtime } from './GlobalRealtime';

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
        className="relative min-h-dvh bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/auth.webp)' }}
      >
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" aria-hidden />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  if (bare) {
    return <div className="min-h-dvh bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <EventRouterGate />
      <GlobalRealtime />
      <OfflineBanner />
      <CommandPalette />
      <TerminalHeader />
      <div className="flex-1">{children}</div>
      <FooterTerminal />
      <AppFooter />
    </div>
  );
}
