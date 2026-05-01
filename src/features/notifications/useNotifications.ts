import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import {
  fetchRecentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from './api';

const queryKey = (userId: string): readonly unknown[] => ['notifications', userId];

export function useNotifications(): {
  data: NotificationRow[] | undefined;
  isLoading: boolean;
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(userId ?? 'anon'),
    enabled: userId !== null,
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return fetchRecentNotifications(getSupabaseClient(), userId);
    },
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKey(userId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const data = query.data;
  return {
    data,
    isLoading: query.isLoading,
    unreadCount: data ? data.filter((n) => n.read_at === null).length : 0,
    markRead: async (id) => {
      await markNotificationRead(getSupabaseClient(), id);
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: queryKey(userId) });
      }
    },
    markAllRead: async () => {
      await markAllNotificationsRead(getSupabaseClient());
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: queryKey(userId) });
      }
    },
  };
}
