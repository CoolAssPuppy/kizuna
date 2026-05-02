import { callEdgeFunction } from '@/lib/edgeFunction';
import { resolveProfileName } from '@/lib/fullName';
import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type NotificationChannel = Database['public']['Enums']['notification_channel'];
export type NotificationType = Database['public']['Enums']['notification_type'];

export interface NudgeHistoryRow {
  id: string;
  sent_at: string;
  recipient_email: string;
  channel: NotificationChannel;
  type: NotificationType;
  subject: string;
  delivered: boolean;
}

/** Shape of the joined users row for the recipient email. Single-row FK join. */
type RecipientJoin = { email: string } | null;

export async function fetchNudgeHistory(client: AppSupabaseClient): Promise<NudgeHistoryRow[]> {
  const { data, error } = await client
    .from('notifications')
    .select(
      `
      id, sent_at, channel, notification_type, subject, delivered,
      users!notifications_user_id_fkey ( email )
    `,
    )
    .order('sent_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sent_at: row.sent_at,
    recipient_email: (row.users as RecipientJoin)?.email ?? '',
    channel: row.channel,
    type: row.notification_type,
    subject: row.subject,
    delivered: row.delivered,
  }));
}

export type NudgeAudience =
  | { kind: 'everyone' }
  | { kind: 'all_employees' }
  | { kind: 'all_guests' }
  | { kind: 'users'; userIds: string[] };

export interface SendNudgePayload {
  channels: NotificationChannel[];
  type: NotificationType;
  subject: string;
  body: string;
  audience: NudgeAudience;
}

interface SendNudgeResult {
  attempted: number;
  delivered: number;
}

const SEND_CONCURRENCY = 8;

/**
 * Fan out a manual nudge to every resolved recipient across every
 * selected channel. Bounded concurrency keeps "all employees + 3
 * channels" from flooding the functions endpoint, but parallelises
 * enough that admin sends finish in seconds rather than minutes.
 */
export async function sendNudge(
  client: AppSupabaseClient,
  payload: SendNudgePayload,
): Promise<SendNudgeResult> {
  if (payload.channels.length === 0) return { attempted: 0, delivered: 0 };
  const recipientIds = await resolveRecipients(client, payload.audience);
  if (recipientIds.length === 0) return { attempted: 0, delivered: 0 };

  const jobs: Array<{ userId: string; channel: NotificationChannel }> = [];
  for (const userId of recipientIds) {
    for (const channel of payload.channels) {
      jobs.push({ userId, channel });
    }
  }

  let delivered = 0;
  for (let i = 0; i < jobs.length; i += SEND_CONCURRENCY) {
    const slice = jobs.slice(i, i + SEND_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map(({ userId, channel }) =>
        callEdgeFunction<{ delivered: boolean }>(client, 'send-notification', {
          userId,
          channel,
          type: payload.type,
          subject: payload.subject,
          body: payload.body,
        }),
      ),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value.delivered) delivered += 1;
    }
  }
  return { attempted: jobs.length, delivered };
}

async function resolveRecipients(
  client: AppSupabaseClient,
  audience: NudgeAudience,
): Promise<string[]> {
  if (audience.kind === 'users') {
    return Array.from(new Set(audience.userIds));
  }
  const base = client.from('users').select('id').eq('is_active', true);
  const filtered = (() => {
    switch (audience.kind) {
      case 'everyone':
        return base.in('role', ['employee', 'guest']);
      case 'all_employees':
        return base.eq('role', 'employee');
      case 'all_guests':
        return base.eq('role', 'guest');
    }
  })();
  const { data, error } = await filtered;
  if (error) throw error;
  return (data ?? []).map((u) => u.id);
}

export interface UserSearchResult {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UserSearchRow {
  id: string;
  email: string;
  role: string;
  employee_profiles: Array<{
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    legal_name: string | null;
  }> | null;
  guest_profiles: Array<{ first_name: string; last_name: string }> | null;
}

export async function searchUsers(
  client: AppSupabaseClient,
  term: string,
  limit = 8,
): Promise<UserSearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const { data, error } = await client
    .from('users')
    .select(
      `
      id, email, role,
      employee_profiles ( first_name, last_name, preferred_name, legal_name ),
      guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
    `,
    )
    .ilike('email', `%${trimmed}%`)
    .eq('is_active', true)
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as UserSearchRow[]).map((row) => {
    const { full } = resolveProfileName(row.employee_profiles?.[0], row.guest_profiles?.[0]);
    return {
      id: row.id,
      email: row.email,
      name: full || row.email,
      role: row.role,
    };
  });
}
