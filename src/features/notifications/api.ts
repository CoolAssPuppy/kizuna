import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];

const RECENT_LIMIT = 30;

export async function fetchRecentNotifications(
  client: AppSupabaseClient,
  userId: string,
): Promise<NotificationRow[]> {
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(
  client: AppSupabaseClient,
  notificationId: string,
): Promise<void> {
  const { error } = await client.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead(client: AppSupabaseClient): Promise<number> {
  const { data, error } = await client.rpc('mark_all_notifications_read');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export function unreadCount(rows: ReadonlyArray<NotificationRow>): number {
  return rows.reduce((acc, n) => (n.read_at === null ? acc + 1 : acc), 0);
}
