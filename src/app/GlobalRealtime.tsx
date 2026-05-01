import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';

/**
 * Mounts once at the app root for every authenticated session. Subscribes to
 * the tables whose changes need to invalidate queries on more than one
 * route — the home screen's editorial feed, the admin dashboards, the
 * notifications center. Without this, a per-screen subscription dies
 * whenever the user navigates away from that screen, so a feed item
 * added on /admin/feed wouldn't refresh the cached query for /.
 *
 * Per-screen subscriptions are still useful for screens that depend on
 * bindings the global subscription doesn't cover, but every cross-route
 * key should be listed here.
 */
export function GlobalRealtime(): null {
  useRealtimeInvalidation([
    // Home screen: editorial feed and facts panel.
    { table: 'feed_items', invalidates: ['home', 'editorial-feed'] },
    { table: 'feed_items', invalidates: ['admin', 'feed'] },
    { table: 'registrations', invalidates: ['home', 'event-stats'] },
    { table: 'registrations', invalidates: ['admin', 'stats'] },
    { table: 'users', invalidates: ['home', 'event-stats'] },
    { table: 'users', invalidates: ['admin', 'stats'] },
    { table: 'document_acknowledgements', invalidates: ['home', 'event-stats'] },
    { table: 'document_acknowledgements', invalidates: ['admin', 'stats'] },

    // Documents and agenda, used by both user-facing and admin views.
    { table: 'documents', invalidates: ['home', 'feed'] },
    { table: 'documents', invalidates: ['admin', 'documents'] },
    { table: 'documents', invalidates: ['documents'] },
    { table: 'sessions', invalidates: ['admin', 'agenda'] },
    { table: 'sessions', invalidates: ['agenda'] },

    // Events list and individual event detail.
    { table: 'events', invalidates: ['admin', 'events'] },
    { table: 'events', invalidates: ['events'] },

    // Conflicts panel.
    { table: 'data_conflicts', invalidates: ['admin', 'conflicts'] },

    // Notifications center.
    { table: 'notifications', invalidates: ['notifications'] },
    { table: 'notifications', invalidates: ['home', 'feed'] },

    // Session favorites — drive the agenda star toggle and counts.
    { table: 'session_registrations', invalidates: ['admin', 'stats'] },
  ]);
  return null;
}
