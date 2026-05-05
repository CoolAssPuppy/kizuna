import type { AppSupabaseClient } from '@/lib/supabase';

export interface AttendingInput {
  attending: boolean;
  /** Ignored when attending is false. */
  firstTime: boolean;
}

/**
 * Calls the security-definer RPC `set_attending`. The RPC handles three
 * states atomically: stamp `is_first_time_attendee`, flip
 * `registrations.status` to `started` or `cancelled`, and tick the
 * `attending` task complete (or skip every sibling on opt-out).
 */
export async function saveAttending(
  client: AppSupabaseClient,
  values: AttendingInput,
): Promise<void> {
  const { error } = await client.rpc('set_attending', {
    p_attending: values.attending,
    p_first_time: values.firstTime,
  });
  if (error) throw error;
}
