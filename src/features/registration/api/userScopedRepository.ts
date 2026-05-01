/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];
type RowOf<T extends keyof Tables> = Tables[T]['Row'];
type InsertOf<T extends keyof Tables> = Tables[T]['Insert'];

interface RepositoryConfig<T extends keyof Tables, F> {
  table: T;
  /** Optional projection. Defaults to '*'. */
  select?: string;
  /** Maps form values to the row payload. user_id must be included. */
  toInsert: (userId: string, values: F) => InsertOf<T>;
}

export interface UserScopedRepository<T extends keyof Tables, F> {
  load: (client: AppSupabaseClient, userId: string) => Promise<RowOf<T> | null>;
  save: (client: AppSupabaseClient, userId: string, values: F) => Promise<void>;
}

/**
 * Generic load/save pair for any table whose unique key is `user_id`.
 * Eliminates the duplicated load/save pair across registration sections.
 *
 * Note on the lint disables: supabase-js's typed query builder requires a
 * string-literal table name to fully infer the row type through `.from()`.
 * With a generic `T extends keyof Tables` the builder collapses to `any`,
 * which is why we silence the unsafe-* rules locally. The exposed API
 * preserves full row typing via `RowOf<T>` / `InsertOf<T>`.
 */
export function createUserScopedRepository<T extends keyof Tables, F>({
  table,
  select = '*',
  toInsert,
}: RepositoryConfig<T, F>): UserScopedRepository<T, F> {
  return {
    async load(client, userId): Promise<RowOf<T> | null> {
      const builder: any = client.from(table as any);
      const { data, error } = await builder
        .select(select)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RowOf<T> | null;
    },
    async save(client, userId, values): Promise<void> {
      const payload = toInsert(userId, values);
      const builder: any = client.from(table as any);
      const { error } = await builder.upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    },
  };
}
