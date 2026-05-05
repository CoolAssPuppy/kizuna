import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SessionGuestAttendanceRow =
  Database['public']['Tables']['session_guest_attendance']['Row'];

/** Compose the key used by the attendance Set so the loader and the lookup site agree. */
export function attendanceKey(sessionId: string, additionalGuestId: string): string {
  return `${sessionId}:${additionalGuestId}`;
}

/**
 * Returns a Set keyed via `attendanceKey()` so the agenda card can do
 * O(1) lookups for "is this guest attending this session". The caller
 * (sponsor) reads only their own rows via RLS.
 */
export async function loadSponsorGuestAttendance(
  client: AppSupabaseClient,
  sponsorId: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from('session_guest_attendance')
    .select('session_id, additional_guest_id, additional_guests!inner(sponsor_id)')
    .eq('additional_guests.sponsor_id', sponsorId);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    set.add(attendanceKey(row.session_id, row.additional_guest_id));
  }
  return set;
}

/** Insert or delete a single (session, guest) attendance row. */
export async function setGuestAttendance(
  client: AppSupabaseClient,
  args: { sessionId: string; additionalGuestId: string; attending: boolean },
): Promise<void> {
  if (args.attending) {
    const { error } = await client.from('session_guest_attendance').insert({
      session_id: args.sessionId,
      additional_guest_id: args.additionalGuestId,
    });
    // Ignore unique-violation: idempotent if the user double-checks.
    if (error && error.code !== '23505') throw error;
    return;
  }
  const { error } = await client
    .from('session_guest_attendance')
    .delete()
    .eq('session_id', args.sessionId)
    .eq('additional_guest_id', args.additionalGuestId);
  if (error) throw error;
}

export interface ExpectedAttendanceRow {
  session_id: string;
  /** Total guests opted-in via session_guest_attendance for this session. */
  guest_count: number;
}

export interface ExpectedAttendanceTotals {
  /** Employees who have an active registration for the event. */
  employeeCount: number;
  /** Per-session guest counts; missing key = zero guests opted in. */
  guestsBySession: Map<string, number>;
}

/**
 * Admin-only aggregation backing the "Current expected attendance"
 * row on the admin agenda view. Employees are counted as the active
 * registrations for the event (they auto-attend audience='all'
 * sessions by definition). Guests come from session_guest_attendance.
 */
export async function loadExpectedAttendance(
  client: AppSupabaseClient,
  eventId: string,
): Promise<ExpectedAttendanceTotals> {
  const [registrations, attendance] = await Promise.all([
    client
      .from('registrations')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('status', 'cancelled'),
    client
      .from('session_guest_attendance')
      .select('session_id, sessions!inner(event_id)')
      .eq('sessions.event_id', eventId),
  ]);
  if (registrations.error) throw registrations.error;
  if (attendance.error) throw attendance.error;
  const guestsBySession = new Map<string, number>();
  for (const row of attendance.data ?? []) {
    guestsBySession.set(row.session_id, (guestsBySession.get(row.session_id) ?? 0) + 1);
  }
  return {
    employeeCount: registrations.count ?? 0,
    guestsBySession,
  };
}
