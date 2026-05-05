import type { Database } from '@/types/database.types';

export type SessionAudience = Database['public']['Enums']['session_audience'];
export type SessionType = Database['public']['Enums']['session_type'];

// Sessions where it makes sense to ask "are your kids coming?" — meals,
// off-property activities, social events. Workshops/keynotes/transport
// don't expose the picker because guests don't typically attend those.
const GUEST_OPT_IN_TYPES: ReadonlySet<SessionType> = new Set<SessionType>([
  'activity',
  'social',
  'dinner',
]);

/**
 * Shared predicate used by the agenda picker (which guests do you want
 * to bring to this session?) and the admin headcount line (where the
 * "+N guests" number is meaningful).
 */
export function isGuestOptInSession(session: {
  audience: SessionAudience;
  type: SessionType;
}): boolean {
  return session.audience === 'all' && GUEST_OPT_IN_TYPES.has(session.type);
}
