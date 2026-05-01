import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

interface TypingUser {
  userId: string;
  displayName: string;
  ts: number;
}

interface PresencePayload {
  userId: string;
  displayName: string;
}

interface Result {
  typingUsers: TypingUser[];
  emitTyping: () => void;
}

const TTL_MS = 5000;
const DEBOUNCE_MS = 1500;

/**
 * Subscribes to a Supabase Realtime presence channel for a community
 * channel slug, exposing the current "typing…" set and a debounced
 * emit function for the local user. Stale entries (>5s) are filtered
 * out so the indicator clears even if a tab disappears.
 */
export function useTypingPresence(slug: string, displayName: string): Result {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null>(
    null,
  );
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!user || !slug) return;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`community-typing:${slug}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'typing' }, ({ payload }: { payload: PresencePayload }) => {
      if (payload.userId === user.id) return;
      setTypingUsers((prev) => {
        const filtered = prev.filter((p) => p.userId !== payload.userId);
        return [...filtered, { ...payload, ts: Date.now() }];
      });
    });

    void channel.subscribe();

    const interval = window.setInterval(() => {
      const cutoff = Date.now() - TTL_MS;
      setTypingUsers((prev) => prev.filter((p) => p.ts >= cutoff));
    }, 1000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [slug, user]);

  function emitTyping(): void {
    if (!user) return;
    const now = Date.now();
    if (now - lastSentRef.current < DEBOUNCE_MS) return;
    lastSentRef.current = now;
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, displayName },
    });
  }

  return { typingUsers, emitTyping };
}
