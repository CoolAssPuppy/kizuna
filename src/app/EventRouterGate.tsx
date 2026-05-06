import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { setEventOverride, useEventOverride } from '@/features/events/eventOverride';
import { useEligibleEvents } from '@/features/events/useEligibleEvents';

/**
 * First-login routing gate. Mounted at the top of `AppLayout` so it runs
 * once per route change for every signed-in user. Behaviour:
 *
 *   - Skipped for unauthenticated users and a small allow-list of routes
 *     where running it would either be circular (`/pick-event`) or
 *     pointless (`/all-events` is the admin override surface; `/cli/*`
 *     paths are the OAuth bridge that needs no event context).
 *   - Auto-selects the only eligible event (no `setEventOverride` round
 *     trip from the user — silent for the 1-event case).
 *   - Redirects to `/pick-event` when the user has zero or many eligible
 *     events without an override.
 *
 * This component renders nothing; it's a side-effecting effect-only gate.
 */

const SKIP_PATHS = new Set<string>([
  '/pick-event',
  '/all-events',
  '/sign-in',
  '/accept-invitation',
]);

const SKIP_PREFIXES = ['/cli/', '/share/'];

export function EventRouterGate(): null {
  const { status } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const override = useEventOverride();
  const { data: events, isLoading } = useEligibleEvents();

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (isLoading) return;
    if (SKIP_PATHS.has(pathname)) return;
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;

    // If the user already has an override AND it's still in their
    // eligible list, leave them where they are. The override pointing
    // to a stale event id is handled by useActiveEvent — it falls back
    // to the most recent eligible event automatically.
    if (override && events.some((e) => e.id === override)) return;

    if (events.length === 1) {
      const only = events[0];
      if (only) setEventOverride(only.id);
      return;
    }

    // 0 or 2+ eligible events without an override: route to picker.
    // (The picker renders the empty state when length === 0.)
    navigate('/pick-event', { replace: true });
  }, [status, isLoading, override, events, pathname, navigate]);

  return null;
}
