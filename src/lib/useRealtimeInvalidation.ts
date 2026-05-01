import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSupabaseClient } from './supabase';

interface RealtimeBinding {
  /** Table name in the public schema (no prefix). */
  table: string;
  /** TanStack Query key prefix to invalidate when a row changes. */
  invalidates: ReadonlyArray<string | number | null>;
  /** Optional postgres filter, e.g. "event_id=eq.<uuid>". */
  filter?: string;
}

/**
 * Subscribe to postgres_changes on one or more tables and invalidate the
 * supplied TanStack Query keys whenever a row is inserted, updated, or
 * deleted. The list of bindings should be stable across renders — pass a
 * memo'd array if it depends on props.
 *
 * Realtime channels are scoped to the current Supabase client so the
 * subscription tears down cleanly on unmount.
 */
export function useRealtimeInvalidation(bindings: ReadonlyArray<RealtimeBinding>): void {
  const queryClient = useQueryClient();
  const fingerprint = bindings
    .map((b) => `${b.table}|${b.filter ?? ''}|${b.invalidates.join('.')}`)
    .join(';');

  // useEffect (not useMountEffect) because subscription identity
  // depends on `fingerprint` — bindings can change at runtime when the
  // active event flips or filters update.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (bindings.length === 0) return;
    const client = getSupabaseClient();
    const channel = client.channel(`rt:${fingerprint}`);

    bindings.forEach((binding) => {
      channel.on(
        // Realtime accepts more event types than the public typings expose
        // (postgres_changes), so the cast keeps the call site readable
        // without leaking `unknown` everywhere.
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: binding.table,
          ...(binding.filter ? { filter: binding.filter } : {}),
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: binding.invalidates });
        },
      );
    });

    void channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, queryClient]);
}
