/**
 * Centralised Supabase Storage bucket names. Keep this file in lockstep
 * with the buckets declared in `supabase/schemas/95_storage.sql`. Adding
 * a new bucket here without updating the schema (or vice versa) breaks
 * the contract documented in README.md / CLAUDE.md / AGENTS.md.
 */
export const STORAGE_BUCKETS = {
  /** Identity-scoped, cross-event. Path: `<user_id>/avatar.<ext>`. */
  avatars: 'avatars',
  /** Admin-managed branding + editorial. Path: `<event_id>/about/...` and `<event_id>/feed/...`. */
  eventContent: 'event-content',
  /** Admin-uploaded PDFs. Path: `<event_id>/<document_id>.pdf`. */
  documents: 'documents',
  /** User-uploaded chat media + photo gallery. Paths under `<event_id>/chats/...` or `<event_id>/gallery/<user_id>/...`. */
  communityMedia: 'community-media',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
