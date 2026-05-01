const MAX_SLUG_LEN = 32;
const MIN_SLUG_LEN = 2;

/**
 * Converts a human channel name into a routing slug acceptable to the
 * channels.slug check constraint (`^[a-z0-9-]{2,32}$`). Returns null if
 * the input has nothing the slug rule can keep.
 */
export function slugifyChannelName(input: string): string | null {
  const slug = input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length < MIN_SLUG_LEN) return null;
  if (slug.length <= MAX_SLUG_LEN) return slug;

  // Truncate at the last hyphen inside the limit so the slug ends on a
  // word boundary instead of a torn syllable.
  const truncated = slug.slice(0, MAX_SLUG_LEN);
  const lastHyphen = truncated.lastIndexOf('-');
  return lastHyphen >= MIN_SLUG_LEN ? truncated.slice(0, lastHyphen) : truncated;
}
