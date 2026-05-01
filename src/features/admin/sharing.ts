/**
 * Shareable report links.
 *
 * The spec is explicit: "shareable link always renders live data — not a
 * frozen snapshot." `report_snapshots` is a token holder, not a copy of
 * the data. We pair an unguessable token with an optional expiry on the
 * row; the public edge function queries the live tables on every hit.
 *
 * 32 bytes of randomness rendered as base64url is 43 characters, well
 * inside any URL/clipboard limit and effectively unguessable. URL-safe
 * with no padding so it pastes cleanly.
 */

const TOKEN_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/share/reports/${token}`;
}
