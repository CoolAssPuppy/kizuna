import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

export interface FeedItem {
  id: string;
  kind: 'document' | 'task' | 'announcement';
  title: string;
  detail: string;
  href?: string;
  createdAt: string;
}

/**
 * Pulls a small mix of items for the home-page activity feed:
 *  - Documents that the current user has not yet acknowledged
 *  - Pending registration tasks
 *  - Recent in-app announcements
 *
 * Everything is bound by the active event. Returns the merged list
 * sorted by recency.
 */
export function useHomeFeed(eventId: string | null): {
  data: FeedItem[] | undefined;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['home', 'feed', eventId, userId],
    enabled: eventId !== null && userId !== null,
    queryFn: () => loadFeed(eventId!, userId!),
    staleTime: 30_000,
  });

  return { data: query.data, isLoading: query.isLoading };
}

async function loadFeed(eventId: string, userId: string): Promise<FeedItem[]> {
  const supabase = getSupabaseClient();
  const items: FeedItem[] = [];

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, version, document_key, requires_acknowledgement, published_at')
    .eq('is_active', true)
    .eq('requires_acknowledgement', true)
    .or(`event_id.eq.${eventId},event_id.is.null`);

  const { data: acks } = await supabase
    .from('document_acknowledgements')
    .select('document_key, document_version')
    .eq('user_id', userId)
    .eq('event_id', eventId);

  for (const doc of documents ?? []) {
    const signed = (acks ?? []).some(
      (a) => a.document_key === doc.document_key && a.document_version === doc.version,
    );
    if (!signed) {
      items.push({
        id: `doc-${doc.id}`,
        kind: 'document',
        title: doc.title,
        detail: 'Awaiting your signature',
        href: `/documents/${doc.id}/sign`,
        createdAt: doc.published_at,
      });
    }
  }

  const { data: tasks } = await supabase
    .from('registration_tasks')
    .select(
      `
      id, task_key, status,
      registrations!inner ( user_id, event_id )
    `,
    )
    .eq('status', 'pending')
    .eq('registrations.user_id', userId)
    .eq('registrations.event_id', eventId);

  for (const task of tasks ?? []) {
    items.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.task_key.replace(/_/g, ' '),
      detail: 'Registration step still open',
      href: `/registration/${task.task_key.replace(/_/g, '-')}`,
      createdAt: new Date().toISOString(),
    });
  }

  const { data: announcements } = await supabase
    .from('notifications')
    .select('id, subject, body, sent_at, notification_type')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(5);

  for (const notification of announcements ?? []) {
    items.push({
      id: `note-${notification.id}`,
      kind: 'announcement',
      title: notification.subject,
      detail: notification.body,
      createdAt: notification.sent_at,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}
