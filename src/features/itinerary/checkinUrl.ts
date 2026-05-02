/**
 * Compose the URL embedded in a user's check-in QR. The payload is a
 * deep link that the door scanner (and any plain QR app like the
 * iPhone Camera) can resolve. user_id alone uniquely identifies the
 * attendee — name and city are display attributes the scanner pulls
 * from the DB once it has the id.
 */
export function buildCheckinUrl(userId: string, eventId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://kizuna.dev';
  return `${origin}/check-in?u=${encodeURIComponent(userId)}&e=${encodeURIComponent(eventId)}`;
}
