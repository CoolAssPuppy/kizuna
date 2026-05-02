/**
 * Composers for every Supabase Storage object name shape kizuna writes.
 * The canonical layout — including which bucket each composer targets —
 * is documented at the top of `supabase/schemas/95_storage.sql`.
 *
 * Why this lives in one place: RLS scopes content per event via the
 * leading path segment. If a caller writes to a path the policies don't
 * recognise, the upload is rejected only after a round trip. Threading
 * every path through these helpers means the JS literal and the schema
 * comment cannot silently drift.
 */

/** Folder for an event's branding assets (logo, cover). Bucket: `event-content`. */
export function eventAboutFolder(eventId: string): string {
  return `${eventId}/about`;
}

/** Folder for an event's home-feed images. Bucket: `event-content`. */
export function eventFeedFolder(eventId: string): string {
  return `${eventId}/feed`;
}

/** Object name for a chat-message attachment. Bucket: `community-media`. */
export function communityChatPath(args: {
  eventId: string;
  channelSlug: string;
  messageId: string;
  ext: string;
}): string {
  return `${args.eventId}/chats/${args.channelSlug}/${args.messageId}/${args.messageId}.${args.ext}`;
}

/** Folder for a user's gallery uploads. Bucket: `community-media`. */
export function communityGalleryFolder(args: {
  eventId: string;
  userId: string;
  mediaItemId: string;
}): string {
  return `${args.eventId}/gallery/${args.userId}/${args.mediaItemId}`;
}

/** Object name for an avatar. Bucket: `avatars`. */
export function avatarPath(userId: string, ext: string): string {
  return `${userId}/avatar.${ext}`;
}
