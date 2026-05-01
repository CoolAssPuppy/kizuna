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
 * supabase-js's generic query builder requires a string-literal table
 * name to infer row types through `.from()`. With a generic
 * `T extends keyof Tables` the typegen collapses, so we widen the
 * builder type to a permissive shape behind one helper. The unsafe
 * disable lives in this single function — every public call site
 * stays fully typed via `RowOf<T>` / `InsertOf<T>` on the wrapping
 * createUserScopedRepository signature.
 */
type GenericPostgrestBuilder = {
  select: (s: string) => GenericPostgrestBuilder;
  upsert: (
    values: unknown,
    options?: { onConflict?: string },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  eq: (col: string, val: string) => GenericPostgrestBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
};

function userScopedTable<T extends keyof Tables>(
  client: AppSupabaseClient,
  table: T,
): GenericPostgrestBuilder {
  // The `as never` + `as unknown as` cast is the workaround for
  // supabase/postgres-js typegen on dynamic table-name generics: the
  // PostgrestQueryBuilder return type collapses to `never` when `table`
  // is `T extends keyof Tables` rather than a string literal, so the
  // chained .select/.upsert/.eq inference dies. The cast shoves us back
  // onto the GenericPostgrestBuilder shape (defined above) which is
  // structurally accurate for the methods we actually call. Single
  // ring-fenced spot — every other api/* module is fully typed.
  return client.from(table as never) as unknown as GenericPostgrestBuilder;
}

/**
 * Generic load/save pair for any table whose unique key is `user_id`.
 * Eliminates the duplicated load/save pair across registration sections.
 */
export function createUserScopedRepository<T extends keyof Tables, F>({
  table,
  select = '*',
  toInsert,
}: RepositoryConfig<T, F>): UserScopedRepository<T, F> {
  return {
    async load(client, userId): Promise<RowOf<T> | null> {
      const { data, error } = await userScopedTable(client, table)
        .select(select)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as RowOf<T> | null;
    },
    async save(client, userId, values): Promise<void> {
      const payload = toInsert(userId, values);
      const { error } = await userScopedTable(client, table).upsert(payload, {
        onConflict: 'user_id',
      });
      if (error) throw new Error(error.message);
    },
  };
}
