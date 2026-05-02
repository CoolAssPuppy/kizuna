/**
 * The gallery search bar accepts three flavours of query:
 *  - `#tag` exact-or-prefix match against event_photo_hashtags
 *  - `@person` autocomplete on tagged users (by name or email)
 *  - free text — ILIKE on caption + tagged-person names
 *
 * classifyQuery is the pure dispatcher; the API layer hands the typed
 * result to the matching loader.
 */

export type GalleryQuery =
  | { kind: 'empty' }
  | { kind: 'hashtag'; value: string }
  | { kind: 'mention'; value: string }
  | { kind: 'text'; value: string };

export function classifyQuery(raw: string): GalleryQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'empty' };
  if (trimmed === '#' || trimmed === '@') return { kind: 'empty' };
  if (trimmed.startsWith('#')) return { kind: 'hashtag', value: trimmed.slice(1).toLowerCase() };
  if (trimmed.startsWith('@')) return { kind: 'mention', value: trimmed.slice(1).toLowerCase() };
  return { kind: 'text', value: trimmed };
}
