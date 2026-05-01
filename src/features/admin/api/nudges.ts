import { callEdgeFunction } from '@/lib/edgeFunction';
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

export async function fetchNudgeHistory(
  client: AppSupabaseClient,
): Promise<NudgeHistoryRow[]> {
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
  | { kind: 'all_employees' }
  | { kind: 'all_guests' }
  | { kind: 'user'; userId: string };

export interface SendNudgePayload {
  channel: NotificationChannel;
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
 * Fan out a manual nudge to every resolved recipient. Uses bounded
 * concurrency (Promise.allSettled in chunks) so that "all employees"
 * doesn't tie up the Supabase functions endpoint with 60+ serialised
 * requests, but also doesn't try to flood it with every recipient at
 * once.
 */
export async function sendNudge(
  client: AppSupabaseClient,
  payload: SendNudgePayload,
): Promise<SendNudgeResult> {
  const recipientIds = await resolveRecipients(client, payload.audience);
  if (recipientIds.length === 0) return { attempted: 0, delivered: 0 };

  let delivered = 0;
  for (let i = 0; i < recipientIds.length; i += SEND_CONCURRENCY) {
    const slice = recipientIds.slice(i, i + SEND_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((userId) =>
        callEdgeFunction<{ delivered: boolean }>(client, 'send-notification', {
          userId,
          channel: payload.channel,
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
  return { attempted: recipientIds.length, delivered };
}

async function resolveRecipients(
  client: AppSupabaseClient,
  audience: NudgeAudience,
): Promise<string[]> {
  if (audience.kind === 'user') return [audience.userId];

  const role = audience.kind === 'all_guests' ? 'guest' : 'employee';
  const { data, error } = await client
    .from('users')
    .select('id')
    .eq('role', role)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map((u) => u.id);
}

export interface UserSearchResult {
  id: string;
  email: string;
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
    .select('id, email')
    .ilike('email', `%${trimmed}%`)
    .eq('is_active', true)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
