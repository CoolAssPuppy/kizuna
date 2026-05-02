import type { AppSupabaseClient } from '@/lib/supabase';

export interface CheckinPayload {
  readonly userId: string;
  readonly eventId: string;
}

/**
 * Parse a scanned QR string. Accepts the URL format that
 * CheckinQrDialog produces — anything else returns null so the UI
 * can render an "invalid code" state instead of crashing.
 */
export function parseCheckinPayload(text: string): CheckinPayload | null {
  try {
    const url = new URL(text);
    if (!url.pathname.endsWith('/check-in')) return null;
    const u = url.searchParams.get('u');
    const e = url.searchParams.get('e');
    if (!u || !e) return null;
    return { userId: u, eventId: e };
  } catch {
    return null;
  }
}

export interface ScannedAttendee {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly avatarSignedUrl: string | null;
  readonly baseCity: string | null;
}

const AVATAR_BUCKET = 'avatars';

/**
 * Resolve a scanned user_id to the display surface the door staff
 * needs: name + photo + base city. Names live on profile tables —
 * employees have first_name + last_name on employee_profiles, guests
 * have full_name on guest_profiles. We try employee first because
 * 99% of scans are employees, then fall back to guest. Returns null
 * when neither has a row.
 */
export async function fetchScannedAttendee(
  client: AppSupabaseClient,
  userId: string,
): Promise<ScannedAttendee | null> {
  const { data: userRow, error: userErr } = await client
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!userRow) return null;

  const { data: employeeRow } = await client
    .from('employee_profiles')
    .select('first_name, last_name, preferred_name, avatar_url, base_city')
    .eq('user_id', userId)
    .maybeSingle();

  let displayName: string | null = null;
  let avatarPath: string | null = null;
  let baseCity: string | null = null;

  if (employeeRow) {
    const composed = [employeeRow.first_name, employeeRow.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    displayName = employeeRow.preferred_name ?? (composed.length > 0 ? composed : null);
    avatarPath = employeeRow.avatar_url;
    baseCity = employeeRow.base_city;
  } else {
    const { data: guestRow } = await client
      .from('guest_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle();
    displayName = guestRow?.full_name ?? null;
  }

  let avatarSignedUrl: string | null = null;
  if (avatarPath) {
    const { data: signed } = await client.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarPath, 60 * 60);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  return {
    userId: userRow.id,
    displayName: displayName ?? userRow.email ?? userId,
    email: userRow.email,
    avatarSignedUrl,
    baseCity,
  };
}
