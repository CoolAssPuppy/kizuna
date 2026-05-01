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
    recipient_email:
      // Supabase typings on the joined relation come back as Joined<> from supabase-js;
      // it is either an object or null when filter doesn't match.
      (row.users as { email: string } | null)?.email ?? '',
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

export async function sendNudge(
  client: AppSupabaseClient,
  payload: SendNudgePayload,
): Promise<SendNudgeResult> {
  const recipientIds = await resolveRecipients(client, payload.audience);
  if (recipientIds.length === 0) return { attempted: 0, delivered: 0 };

  let delivered = 0;
  for (const userId of recipientIds) {
    const response = await client.functions.invoke<{ delivered: boolean }>(
      'send-notification',
      {
        body: {
          userId,
          channel: payload.channel,
          type: payload.type,
          subject: payload.subject,
          body: payload.body,
        },
      },
    );
    if (response.error) throw response.error;
    if (response.data?.delivered) delivered += 1;
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
